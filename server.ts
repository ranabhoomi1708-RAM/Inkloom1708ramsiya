import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import {
  calculateComplianceScore,
  createSeededStore,
  enrichFact,
  generateDiff,
  getAnalyticsSummary,
  hashPassword,
  recordAuditEvent,
  verifyPassword,
} from './server/store.ts';
import {
  analyzeAttachedImage,
  extractRulesFromGuideline,
  generateEnhancementOptions,
  getAvailablePackNames,
  runPipeline,
} from './server/engine.ts';
import type { ActiveContext, ApprovedFact, Brand, Finding, Guideline, Review, Rule, Submission } from './server/types.ts';

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

const store = createSeededStore();

const TOKEN_SECRET = process.env.JWT_SECRET || 'inkloom-dev-secret-key';

function signToken(payload: Record<string, unknown>): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function resolveContext(req: Request): ActiveContext {
  const authHeader = (req.headers.authorization || '').trim();
  const demoRoleHeader = (req.headers['x-demo-role'] as string | undefined)?.trim().toLowerCase();

  let tokenStr = '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    tokenStr = authHeader.slice(7).trim();
  }

  // Check signed token
  if (tokenStr && tokenStr.includes('.')) {
    const payload = verifyToken(tokenStr);
    if (payload && typeof payload.sub === 'number' && typeof payload.org_id === 'number') {
      const user = store.users.find((u) => u.id === payload.sub && u.is_active);
      const org = store.organizations.find((o) => o.id === payload.org_id);
      const membership = store.memberships.find(
        (m) => m.user_id === payload.sub && m.org_id === payload.org_id && m.is_active,
      );
      if (user && org && membership) {
        return {
          user,
          org,
          membership,
          activeRole: membership.role,
          activeDepartment: membership.department,
        };
      }
    }
  }

  // Resolve demo persona from token or X-Demo-Role header
  let role = 'employee';
  if (tokenStr === 'demo-token-admin' || tokenStr === 'admin-token') role = 'admin';
  else if (tokenStr === 'demo-token-manager' || tokenStr === 'manager-token') role = 'manager';
  else if (tokenStr === 'demo-token-employee' || tokenStr === 'employee-token') role = 'employee';
  else if (demoRoleHeader && ['admin', 'employee', 'manager'].includes(demoRoleHeader)) {
    role = demoRoleHeader;
  }

  const orgIdHeader = Number(req.headers['x-org-id'] || 1);
  const org = store.organizations.find((o) => o.id === orgIdHeader) || store.organizations[0];

  const membership =
    store.memberships.find((m) => m.org_id === org.id && m.role === role && m.is_active) ||
    store.memberships.find((m) => m.org_id === org.id && m.is_active) ||
    store.memberships[1];

  const user = store.users.find((u) => u.id === membership.user_id) || store.users[1];

  return {
    user,
    org,
    membership,
    activeRole: membership.role,
    activeDepartment: membership.department,
  };
}

function buildUserOut(ctx: ActiveContext) {
  const userMemberships = store.memberships
    .filter((m) => m.user_id === ctx.user.id && m.is_active)
    .map((m) => {
      const o = store.organizations.find((org) => org.id === m.org_id);
      return {
        org_id: m.org_id,
        org_name: o?.name || '',
        org_slug: o?.slug || '',
        role: m.role,
        department: m.department,
      };
    });

  return {
    id: ctx.user.id,
    email: ctx.user.email,
    name: ctx.user.name,
    role: ctx.activeRole,
    department: ctx.activeDepartment,
    is_active: ctx.user.is_active,
    organizations: userMemberships,
  };
}

function enrichSubmissionDetail(sub: Submission) {
  const author = store.users.find((u) => u.id === sub.author_id);
  const findings = store.findings.filter((f) => f.submission_id === sub.id && f.org_id === sub.org_id);
  const versions = store.submissionVersions
    .filter((v) => v.submission_id === sub.id && v.org_id === sub.org_id)
    .sort((a, b) => a.version_number - b.version_number);
  const reviews = store.reviews
    .filter((r) => r.submission_id === sub.id && r.org_id === sub.org_id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return {
    ...sub,
    author_name: author?.name ?? null,
    findings,
    versions,
    reviews,
  };
}

function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ctx = resolveContext(req);
    if (!allowedRoles.includes(ctx.activeRole)) {
      res.status(403).json({
        detail: `Forbidden: Requires one of [${allowedRoles.join(', ')}], current role is '${ctx.activeRole}'.`,
        status_code: 403,
      });
      return;
    }
    (req as Request & { ctx?: ActiveContext }).ctx = ctx;
    next();
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Security headers matching FastAPI middleware (allow iframe embedding in AI Studio)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Static directories for sample assets and uploads
  const sampleDir = path.resolve(process.cwd(), 'sample_data');
  if (fs.existsSync(sampleDir)) {
    app.use('/sample_data', express.static(sampleDir));
  }
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', app: 'Inkloom AI', version: '2.0.0' });
  });

  // ===========================================================================
  // AUTH ROUTES
  // ===========================================================================
  app.post('/api/auth/demo-login', (req, res) => {
    const requestedRole = String(req.body?.role || 'employee').trim().toLowerCase();
    const role = ['admin', 'employee', 'manager'].includes(requestedRole) ? requestedRole : 'employee';
    const org = store.organizations[0];
    const membership =
      store.memberships.find((m) => m.org_id === org.id && m.role === role) || store.memberships[1];
    const user = store.users.find((u) => u.id === membership.user_id) || store.users[1];
    const ctx: ActiveContext = {
      user,
      org,
      membership,
      activeRole: membership.role,
      activeDepartment: membership.department,
    };
    const token = signToken({ sub: user.id, org_id: org.id, role: membership.role, type: 'access' });
    const refresh = signToken({ sub: user.id, org_id: org.id, type: 'refresh' });
    res.json({
      access_token: token,
      refresh_token: refresh,
      token_type: 'bearer',
      user: buildUserOut(ctx),
      organization: org,
    });
  });

  app.post('/api/auth/register', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const name = String(req.body?.name || '').trim();
    const orgName = String(req.body?.org_name || '').trim();
    const password = String(req.body?.password || 'DemoPassword123!');
    const industry = String(req.body?.industry || 'general').trim().toLowerCase();
    const department = String(req.body?.department || 'Executive').trim();

    if (!email || !name || !orgName) {
      res.status(422).json({ detail: 'email, name, and org_name are required.', status_code: 422 });
      return;
    }

    let slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'org';
    if (store.organizations.some((o) => o.slug === slug)) {
      slug = `${slug}-${Date.now() % 10000}`;
    }

    const org = {
      id: store.nextIds.org++,
      name: orgName,
      slug,
      industry: ['skincare', 'food & beverage', 'finance', 'electronics', 'general'].includes(industry)
        ? industry
        : 'general',
      settings: { enabled_rule_packs: ['india_ads', 'dark_patterns', 'brand_voice'] },
      created_at: new Date().toISOString(),
    };
    store.organizations.push(org);

    let user = store.users.find((u) => u.email === email);
    if (!user) {
      user = {
        id: store.nextIds.user++,
        email,
        name,
        role: 'admin',
        department,
        password_hash: hashPassword(password),
        is_active: true,
        created_at: new Date().toISOString(),
      };
      store.users.push(user);
    }

    const membership = {
      id: store.nextIds.membership++,
      user_id: user.id,
      org_id: org.id,
      role: 'admin',
      department,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    store.memberships.push(membership);

    store.brands.push({
      id: store.nextIds.brand++,
      org_id: org.id,
      name: org.name,
      tagline: `Official ${org.name} Workspace`,
      logo_url: null,
      palette: { primary: '#1A6B66', deep_teal: '#133B3B', cream: '#F7F4EC' },
      created_at: new Date().toISOString(),
    });

    const ctx: ActiveContext = {
      user,
      org,
      membership,
      activeRole: 'admin',
      activeDepartment: department,
    };
    const token = signToken({ sub: user.id, org_id: org.id, role: 'admin', type: 'access' });
    const refresh = signToken({ sub: user.id, org_id: org.id, type: 'refresh' });
    res.json({
      access_token: token,
      refresh_token: refresh,
      token_type: 'bearer',
      user: buildUserOut(ctx),
      organization: org,
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const orgSlug = req.body?.org_slug ? String(req.body.org_slug).trim().toLowerCase() : null;

    const user = store.users.find((u) => u.email === email && u.is_active);
    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ detail: 'Invalid email or password.', status_code: 401 });
      return;
    }

    let targetOrg = orgSlug ? store.organizations.find((o) => o.slug === orgSlug) : null;
    if (orgSlug && !targetOrg) {
      res.status(401).json({ detail: 'Invalid organization or membership.', status_code: 401 });
      return;
    }

    const membership = targetOrg
      ? store.memberships.find((m) => m.user_id === user.id && m.org_id === targetOrg!.id && m.is_active)
      : store.memberships.find((m) => m.user_id === user.id && m.is_active);

    if (!membership) {
      res.status(401).json({ detail: 'Invalid organization or membership.', status_code: 401 });
      return;
    }
    targetOrg = targetOrg || store.organizations.find((o) => o.id === membership.org_id)!;

    const ctx: ActiveContext = {
      user,
      org: targetOrg,
      membership,
      activeRole: membership.role,
      activeDepartment: membership.department,
    };
    const token = signToken({ sub: user.id, org_id: targetOrg.id, role: membership.role, type: 'access' });
    const refresh = signToken({ sub: user.id, org_id: targetOrg.id, type: 'refresh' });
    res.json({
      access_token: token,
      refresh_token: refresh,
      token_type: 'bearer',
      user: buildUserOut(ctx),
      organization: targetOrg,
    });
  });

  app.post('/api/auth/refresh', (req, res) => {
    const payload = verifyToken(String(req.body?.refresh_token || ''));
    if (!payload || payload.type !== 'refresh') {
      res.status(401).json({ detail: 'Invalid refresh token.', status_code: 401 });
      return;
    }
    const user = store.users.find((u) => u.id === Number(payload.sub) && u.is_active);
    const org = store.organizations.find((o) => o.id === Number(payload.org_id));
    const membership = store.memberships.find(
      (m) => m.user_id === Number(payload.sub) && m.org_id === Number(payload.org_id) && m.is_active,
    );
    if (!user || !org || !membership) {
      res.status(403).json({ detail: 'Active membership not found.', status_code: 403 });
      return;
    }
    const ctx: ActiveContext = {
      user,
      org,
      membership,
      activeRole: membership.role,
      activeDepartment: membership.department,
    };
    const token = signToken({ sub: user.id, org_id: org.id, role: membership.role, type: 'access' });
    const refresh = signToken({ sub: user.id, org_id: org.id, type: 'refresh' });
    res.json({
      access_token: token,
      refresh_token: refresh,
      token_type: 'bearer',
      user: buildUserOut(ctx),
      organization: org,
    });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.json({ status: 'logged_out', detail: 'Session ended successfully.' });
  });

  app.get('/api/auth/me', (req, res) => {
    const ctx = resolveContext(req);
    res.json(buildUserOut(ctx));
  });

  app.post('/api/auth/switch-org', (req, res) => {
    const ctx = resolveContext(req);
    const orgSlug = req.body?.org_slug ? String(req.body.org_slug).trim().toLowerCase() : null;
    const orgId = req.body?.org_id ? Number(req.body.org_id) : null;
    const targetOrg = orgSlug
      ? store.organizations.find((o) => o.slug === orgSlug)
      : store.organizations.find((o) => o.id === orgId);

    if (!targetOrg) {
      res.status(404).json({ detail: 'Target organization not found.', status_code: 404 });
      return;
    }
    const membership = store.memberships.find(
      (m) => m.user_id === ctx.user.id && m.org_id === targetOrg.id && m.is_active,
    );
    if (!membership) {
      res.status(403).json({ detail: 'Access denied: Not an active member of this organization.', status_code: 403 });
      return;
    }
    const nextCtx: ActiveContext = {
      user: ctx.user,
      org: targetOrg,
      membership,
      activeRole: membership.role,
      activeDepartment: membership.department,
    };
    const token = signToken({ sub: ctx.user.id, org_id: targetOrg.id, role: membership.role, type: 'access' });
    const refresh = signToken({ sub: ctx.user.id, org_id: targetOrg.id, type: 'refresh' });
    res.json({
      access_token: token,
      refresh_token: refresh,
      token_type: 'bearer',
      user: buildUserOut(nextCtx),
      organization: targetOrg,
    });
  });

  // ===========================================================================
  // BRAND ROUTES
  // ===========================================================================
  app.get('/api/brand', (req, res) => {
    const ctx = resolveContext(req);
    let brand = store.brands.find((b) => b.org_id === ctx.org.id);
    if (!brand) {
      brand = {
        id: store.nextIds.brand++,
        org_id: ctx.org.id,
        name: ctx.org.name,
        tagline: 'Pure Botanical Radiance, Backed by Science',
        logo_url: '/sample_data/glowleaf_logo.png',
        palette: {
          cream: '#F7F4EC',
          warm_white: '#FFFDF9',
          deep_teal: '#133B3B',
          teal: '#1A6B66',
          coral: '#E8775D',
          mint: '#DCEEEB',
          blush: '#FAE3DC',
        },
        created_at: new Date().toISOString(),
      };
      store.brands.push(brand);
    }
    res.json(brand);
  });

  app.post('/api/brand', requireRole(['admin']), (req, res) => {
    const ctx = resolveContext(req);
    let brand = store.brands.find((b) => b.org_id === ctx.org.id);
    let before: Record<string, unknown> | null = null;
    if (!brand) {
      brand = {
        id: store.nextIds.brand++,
        org_id: ctx.org.id,
        name: String(req.body?.name || ctx.org.name),
        tagline: req.body?.tagline ?? null,
        logo_url: req.body?.logo_url ?? null,
        palette: req.body?.palette ?? null,
        created_at: new Date().toISOString(),
      };
      store.brands.push(brand);
    } else {
      before = { name: brand.name, tagline: brand.tagline, palette: brand.palette };
      if (req.body?.name !== undefined) brand.name = String(req.body.name);
      if (req.body?.tagline !== undefined) brand.tagline = req.body.tagline;
      if (req.body?.logo_url !== undefined) brand.logo_url = req.body.logo_url;
      if (req.body?.palette !== undefined) brand.palette = req.body.palette;
    }

    recordAuditEvent(
      store,
      ctx.org.id,
      { id: ctx.user.id, name: ctx.user.name, role: ctx.activeRole },
      'brand_update',
      'brand',
      brand.id,
      before,
      { name: brand.name, tagline: brand.tagline, palette: brand.palette },
    );
    res.json(brand);
  });

  // ===========================================================================
  // APPROVED FACTS ROUTES
  // ===========================================================================
  app.get('/api/facts', (req, res) => {
    const ctx = resolveContext(req);
    const includeExpired = req.query.include_expired !== 'false';
    const includeSuperseded = req.query.include_superseded !== 'false';
    const orgFacts = store.facts.filter((f) => f.org_id === ctx.org.id);
    const enriched = orgFacts
      .map((f) => enrichFact(f, orgFacts))
      .filter((f) => (includeExpired || !f.is_expired) && (includeSuperseded || !f.is_superseded));
    res.json(enriched);
  });

  app.post('/api/facts', requireRole(['admin']), (req, res) => {
    const ctx = resolveContext(req);
    const statement = String(req.body?.statement || '').trim();
    const source = String(req.body?.source || '').trim();
    if (!statement || !source) {
      res.status(422).json({ detail: 'statement and source are required.', status_code: 422 });
      return;
    }
    const newFact: ApprovedFact = {
      id: store.nextIds.fact++,
      org_id: ctx.org.id,
      statement,
      source,
      version: 1,
      valid_until: req.body?.valid_until || null,
      supersedes_id: req.body?.supersedes_id ? Number(req.body.supersedes_id) : null,
      created_at: new Date().toISOString(),
    };
    store.facts.push(newFact);

    recordAuditEvent(
      store,
      ctx.org.id,
      { id: ctx.user.id, name: ctx.user.name, role: ctx.activeRole },
      'fact_create',
      'approved_fact',
      newFact.id,
      null,
      { statement: newFact.statement, source: newFact.source, valid_until: newFact.valid_until },
    );
    const orgFacts = store.facts.filter((f) => f.org_id === ctx.org.id);
    res.status(201).json(enrichFact(newFact, orgFacts));
  });

  app.get('/api/facts/:id', (req, res) => {
    const ctx = resolveContext(req);
    const id = Number(req.params.id);
    const fact = store.facts.find((f) => f.id === id && f.org_id === ctx.org.id);
    if (!fact) {
      res.status(404).json({ detail: `Fact with ID ${id} not found.`, status_code: 404 });
      return;
    }
    const orgFacts = store.facts.filter((f) => f.org_id === ctx.org.id);
    res.json(enrichFact(fact, orgFacts));
  });

  app.put('/api/facts/:id', requireRole(['admin']), (req, res) => {
    const ctx = resolveContext(req);
    const id = Number(req.params.id);
    const fact = store.facts.find((f) => f.id === id && f.org_id === ctx.org.id);
    if (!fact) {
      res.status(404).json({ detail: `Fact with ID ${id} not found.`, status_code: 404 });
      return;
    }
    const before = { statement: fact.statement, source: fact.source, valid_until: fact.valid_until };
    if (req.body?.statement !== undefined) fact.statement = String(req.body.statement);
    if (req.body?.source !== undefined) fact.source = String(req.body.source);
    if (req.body?.valid_until !== undefined) fact.valid_until = req.body.valid_until;
    if (req.body?.supersedes_id !== undefined) fact.supersedes_id = req.body.supersedes_id;

    recordAuditEvent(
      store,
      ctx.org.id,
      { id: ctx.user.id, name: ctx.user.name, role: ctx.activeRole },
      'fact_update',
      'approved_fact',
      fact.id,
      before,
      { statement: fact.statement, source: fact.source, valid_until: fact.valid_until },
    );
    const orgFacts = store.facts.filter((f) => f.org_id === ctx.org.id);
    res.json(enrichFact(fact, orgFacts));
  });

  app.delete('/api/facts/:id', requireRole(['admin']), (req, res) => {
    const ctx = resolveContext(req);
    const id = Number(req.params.id);
    const idx = store.facts.findIndex((f) => f.id === id && f.org_id === ctx.org.id);
    if (idx === -1) {
      res.status(404).json({ detail: `Fact with ID ${id} not found.`, status_code: 404 });
      return;
    }
    const [removed] = store.facts.splice(idx, 1);
    recordAuditEvent(
      store,
      ctx.org.id,
      { id: ctx.user.id, name: ctx.user.name, role: ctx.activeRole },
      'fact_delete',
      'approved_fact',
      id,
      { statement: removed.statement, source: removed.source },
      null,
    );
    res.status(204).send();
  });

  // ===========================================================================
  // RULES ROUTES
  // ===========================================================================
  app.get('/api/rules', (req, res) => {
    const ctx = resolveContext(req);
    let list = store.rules.filter((r) => r.org_id === ctx.org.id);
    if (req.query.type) list = list.filter((r) => r.type === req.query.type);
    if (req.query.severity) list = list.filter((r) => r.severity === req.query.severity);
    if (req.query.pack) list = list.filter((r) => r.pack === req.query.pack);
    if (req.query.is_active !== undefined) {
      const wantActive = req.query.is_active === 'true';
      list = list.filter((r) => r.is_active === wantActive);
    }
    res.json(list);
  });

  app.post('/api/rules', requireRole(['admin']), (req, res) => {
    const ctx = resolveContext(req);
    const rule: Rule = {
      id: store.nextIds.rule++,
      org_id: ctx.org.id,
      title: String(req.body?.title || ''),
      type: String(req.body?.type || 'regulatory'),
      severity: String(req.body?.severity || 'medium'),
      pack: String(req.body?.pack || 'brand_voice'),
      description: String(req.body?.description || ''),
      disclaimer: String(req.body?.disclaimer || 'Checklist aid, not legal advice.'),
      is_active: true,
      created_at: new Date().toISOString(),
    };
    store.rules.push(rule);
    recordAuditEvent(
      store,
      ctx.org.id,
      { id: ctx.user.id, name: ctx.user.name, role: ctx.activeRole },
      'rule_create',
      'rule',
      rule.id,
      null,
      { title: rule.title, type: rule.type, severity: rule.severity },
    );
    res.status(201).json(rule);
  });

  app.get('/api/rules/:id', (req, res) => {
    const ctx = resolveContext(req);
    const id = Number(req.params.id);
    const rule = store.rules.find((r) => r.id === id && r.org_id === ctx.org.id);
    if (!rule) {
      res.status(404).json({ detail: `Rule with ID ${id} not found.`, status_code: 404 });
      return;
    }
    res.json(rule);
  });

  app.put('/api/rules/:id', requireRole(['admin']), (req, res) => {
    const ctx = resolveContext(req);
    const id = Number(req.params.id);
    const rule = store.rules.find((r) => r.id === id && r.org_id === ctx.org.id);
    if (!rule) {
      res.status(404).json({ detail: `Rule with ID ${id} not found.`, status_code: 404 });
      return;
    }
    const before = { title: rule.title, type: rule.type, severity: rule.severity, is_active: rule.is_active };
    if (req.body?.title !== undefined) rule.title = String(req.body.title);
    if (req.body?.type !== undefined) rule.type = String(req.body.type);
    if (req.body?.severity !== undefined) rule.severity = String(req.body.severity);
    if (req.body?.pack !== undefined) rule.pack = String(req.body.pack);
    if (req.body?.description !== undefined) rule.description = String(req.body.description);
    if (req.body?.disclaimer !== undefined) rule.disclaimer = String(req.body.disclaimer);
    if (req.body?.is_active !== undefined) rule.is_active = Boolean(req.body.is_active);

    recordAuditEvent(
      store,
      ctx.org.id,
      { id: ctx.user.id, name: ctx.user.name, role: ctx.activeRole },
      'rule_update',
      'rule',
      rule.id,
      before,
      { title: rule.title, type: rule.type, severity: rule.severity, is_active: rule.is_active },
    );
    res.json(rule);
  });

  app.delete('/api/rules/:id', requireRole(['admin']), (req, res) => {
    const ctx = resolveContext(req);
    const id = Number(req.params.id);
    const idx = store.rules.findIndex((r) => r.id === id && r.org_id === ctx.org.id);
    if (idx === -1) {
      res.status(404).json({ detail: `Rule with ID ${id} not found.`, status_code: 404 });
      return;
    }
    const [removed] = store.rules.splice(idx, 1);
    recordAuditEvent(
      store,
      ctx.org.id,
      { id: ctx.user.id, name: ctx.user.name, role: ctx.activeRole },
      'rule_delete',
      'rule',
      id,
      { title: removed.title, type: removed.type },
      null,
    );
    res.status(204).send();
  });

  // ===========================================================================
  // GUIDELINES ROUTES
  // ===========================================================================
  app.get('/api/guidelines', (req, res) => {
    const ctx = resolveContext(req);
    res.json(store.guidelines.filter((g) => g.org_id === ctx.org.id));
  });

  app.post('/api/guidelines/upload', requireRole(['admin']), upload.single('file'), (req, res) => {
    const ctx = resolveContext(req);
    const file = req.file;
    const title = String(req.body?.title || file?.originalname || 'Uploaded Guideline').trim();
    if (!file) {
      res.status(400).json({ detail: 'No file provided.', status_code: 400 });
      return;
    }
    const filename = file.originalname || 'guideline.txt';
    const ext = path.extname(filename).toLowerCase();
    if (!['.txt', '.pdf', '.md'].includes(ext)) {
      res.status(400).json({ detail: `Unsupported file format '${ext}'. Only .pdf and .txt are allowed.`, status_code: 400 });
      return;
    }

    let extractedText = '';
    if (ext === '.pdf') {
      // Extract readable ASCII/UTF-8 text segments from PDF stream
      const raw = file.buffer.toString('latin1');
      const matches = raw.match(/\(([^()]{3,})\)/g) || [];
      extractedText = matches
        .map((m) => m.slice(1, -1).replace(/\\[nrt]/g, ' '))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!extractedText) {
        extractedText = `Uploaded PDF guideline: ${title} (${filename}). Review and extract policy rules.`;
      }
    } else {
      extractedText = file.buffer.toString('utf-8').trim();
    }

    if (!extractedText) {
      res.status(400).json({ detail: 'Uploaded document is empty or text could not be extracted.', status_code: 400 });
      return;
    }

    const guideline: Guideline = {
      id: store.nextIds.guideline++,
      org_id: ctx.org.id,
      title,
      filename,
      content_text: extractedText,
      created_at: new Date().toISOString(),
    };
    store.guidelines.push(guideline);

    recordAuditEvent(
      store,
      ctx.org.id,
      { id: ctx.user.id, name: ctx.user.name, role: ctx.activeRole },
      'guideline_upload',
      'guideline',
      guideline.id,
      null,
      { title: guideline.title, filename: guideline.filename },
    );
    res.status(201).json(guideline);
  });

  app.get('/api/guidelines/:id', (req, res) => {
    const ctx = resolveContext(req);
    const id = Number(req.params.id);
    const guideline = store.guidelines.find((g) => g.id === id && g.org_id === ctx.org.id);
    if (!guideline) {
      res.status(404).json({ detail: `Guideline with ID ${id} not found.`, status_code: 404 });
      return;
    }
    res.json(guideline);
  });

  app.post('/api/guidelines/:id/extract-rules', requireRole(['admin']), (req, res) => {
    const ctx = resolveContext(req);
    const id = Number(req.params.id);
    const guideline = store.guidelines.find((g) => g.id === id && g.org_id === ctx.org.id);
    if (!guideline) {
      res.status(404).json({ detail: `Guideline with ID ${id} not found.`, status_code: 404 });
      return;
    }
    const suggestedRules = extractRulesFromGuideline(guideline.content_text);
    res.json({ guideline_id: guideline.id, suggested_rules: suggestedRules });
  });

  app.post('/api/guidelines/:id/approve-rules', requireRole(['admin']), (req, res) => {
    const ctx = resolveContext(req);
    const id = Number(req.params.id);
    const guideline = store.guidelines.find((g) => g.id === id && g.org_id === ctx.org.id);
    if (!guideline) {
      res.status(404).json({ detail: `Guideline with ID ${id} not found.`, status_code: 404 });
      return;
    }
    const drafts = Array.isArray(req.body?.rules) ? req.body.rules : [];
    const created: Rule[] = drafts.map((r: Record<string, unknown>) => {
      const rule: Rule = {
        id: store.nextIds.rule++,
        org_id: ctx.org.id,
        title: String(r.title || 'Extracted Rule'),
        type: String(r.type || 'regulatory'),
        severity: String(r.severity || 'medium'),
        pack: String(r.pack || 'brand_voice'),
        description: String(r.description || ''),
        disclaimer: String(r.disclaimer || 'Checklist aid, not legal advice.'),
        is_active: true,
        created_at: new Date().toISOString(),
      };
      store.rules.push(rule);
      return rule;
    });

    recordAuditEvent(
      store,
      ctx.org.id,
      { id: ctx.user.id, name: ctx.user.name, role: ctx.activeRole },
      'rules_bulk_approved',
      'guideline',
      guideline.id,
      null,
      { count: created.length, rule_ids: created.map((r) => r.id) },
    );
    res.status(201).json(created);
  });

  // ===========================================================================
  // SUBMISSIONS & WORKFLOW ROUTES
  // ===========================================================================
  app.get('/api/submissions', (req, res) => {
    const ctx = resolveContext(req);
    let subs = store.submissions.filter((s) => s.org_id === ctx.org.id);
    if (ctx.activeRole === 'employee') {
      subs = subs.filter((s) => s.author_id === ctx.user.id);
    }
    subs = [...subs].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    const result = subs.map((s) => {
      const author = store.users.find((u) => u.id === s.author_id);
      const findings = store.findings.filter((f) => f.submission_id === s.id && f.org_id === s.org_id);
      return { ...s, author_name: author?.name ?? null, findings };
    });
    res.json(result);
  });

  app.post('/api/submissions', (req, res) => {
    const ctx = resolveContext(req);
    const now = new Date().toISOString();
    const submission: Submission = {
      id: store.nextIds.submission++,
      org_id: ctx.org.id,
      title: String(req.body?.title || 'Untitled Campaign Copy'),
      author_id: ctx.user.id,
      department: String(req.body?.department || ctx.activeDepartment || 'Performance Marketing'),
      version: 1,
      status: 'draft',
      compliance_score: 100.0,
      content_text: String(req.body?.content_text || ''),
      image_path: req.body?.image_path || null,
      created_at: now,
      updated_at: now,
    };
    store.submissions.push(submission);
    store.submissionVersions.push({
      id: store.nextIds.version++,
      org_id: ctx.org.id,
      submission_id: submission.id,
      version_number: 1,
      content_text: submission.content_text,
      diff_from_previous: null,
      created_at: now,
    });

    recordAuditEvent(
      store,
      ctx.org.id,
      { id: ctx.user.id, name: ctx.user.name, role: ctx.activeRole },
      'submission_create',
      'submission',
      submission.id,
      null,
      { title: submission.title, status: submission.status, version: 1 },
    );
    res.status(201).json(enrichSubmissionDetail(submission));
  });

  app.post('/api/submissions/upload-image', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ detail: 'No image file provided.', status_code: 400 });
      return;
    }
    const filename = file.originalname || 'image.png';
    const ext = path.extname(filename).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) {
      res.status(400).json({ detail: `Unsupported image format '${ext}'.`, status_code: 400 });
      return;
    }
    const subDir = path.join(uploadsDir, 'submissions');
    fs.mkdirSync(subDir, { recursive: true });
    const uniqueName = `${crypto.randomUUID().slice(0, 8)}_${path.basename(filename)}`;
    fs.writeFileSync(path.join(subDir, uniqueName), file.buffer);
    res.json({ image_path: `/uploads/submissions/${uniqueName}`, filename });
  });

  app.get('/api/submissions/:id', (req, res) => {
    const ctx = resolveContext(req);
    const id = Number(req.params.id);
    const sub = store.submissions.find((s) => s.id === id && s.org_id === ctx.org.id);
    if (!sub) {
      res.status(404).json({ detail: `Submission with ID ${id} not found.`, status_code: 404 });
      return;
    }
    if (ctx.activeRole === 'employee' && sub.author_id !== ctx.user.id) {
      res.status(403).json({ detail: 'Forbidden: You can only view your own submissions.', status_code: 403 });
      return;
    }
    res.json(enrichSubmissionDetail(sub));
  });

  app.put('/api/submissions/:id', (req, res) => {
    const ctx = resolveContext(req);
    const id = Number(req.params.id);
    const sub = store.submissions.find((s) => s.id === id && s.org_id === ctx.org.id);
    if (!sub) {
      res.status(404).json({ detail: `Submission with ID ${id} not found.`, status_code: 404 });
      return;
    }
    if (ctx.activeRole === 'employee' && sub.author_id !== ctx.user.id) {
      res.status(403).json({ detail: 'Forbidden: You can only edit your own submissions.', status_code: 403 });
      return;
    }
    if (!['draft', 'revision_requested'].includes(sub.status)) {
      res.status(409).json({
        detail: `Cannot edit submission in status '${sub.status}'. Allowed only in 'draft' or 'revision_requested'.`,
        status_code: 409,
      });
      return;
    }

    const oldText = sub.content_text;
    const oldVersion = sub.version;
    const newVersion = oldVersion + 1;
    const newText = String(req.body?.content_text ?? oldText);
    const diffStr = generateDiff(oldText, newText, oldVersion, newVersion);
    const now = new Date().toISOString();

    store.submissionVersions.push({
      id: store.nextIds.version++,
      org_id: ctx.org.id,
      submission_id: sub.id,
      version_number: newVersion,
      content_text: newText,
      diff_from_previous: diffStr,
      created_at: now,
    });

    const beforeState = { version: oldVersion, title: sub.title, status: sub.status };
    if (req.body?.title) sub.title = String(req.body.title);
    if (req.body?.image_path !== undefined) sub.image_path = req.body.image_path;
    sub.content_text = newText;
    sub.version = newVersion;
    sub.status = 'draft';
    sub.updated_at = now;

    recordAuditEvent(
      store,
      ctx.org.id,
      { id: ctx.user.id, name: ctx.user.name, role: ctx.activeRole },
      'submission_edit',
      'submission',
      sub.id,
      beforeState,
      { version: newVersion, title: sub.title, status: sub.status, diff: diffStr },
    );

    res.json(enrichSubmissionDetail(sub));
  });

  app.get('/api/submissions/:id/versions', (req, res) => {
    const ctx = resolveContext(req);
    const id = Number(req.params.id);
    const sub = store.submissions.find((s) => s.id === id && s.org_id === ctx.org.id);
    if (!sub) {
      res.status(404).json({ detail: `Submission with ID ${id} not found.`, status_code: 404 });
      return;
    }
    if (ctx.activeRole === 'employee' && sub.author_id !== ctx.user.id) {
      res.status(403).json({ detail: 'Forbidden: You can only view your own versions.', status_code: 403 });
      return;
    }
    const versions = store.submissionVersions
      .filter((v) => v.submission_id === sub.id && v.org_id === ctx.org.id)
      .sort((a, b) => a.version_number - b.version_number);
    res.json(versions);
  });

  app.post('/api/submissions/:id/check', async (req, res) => {
    const ctx = resolveContext(req);
    const id = Number(req.params.id);
    const sub = store.submissions.find((s) => s.id === id && s.org_id === ctx.org.id);
    if (!sub) {
      res.status(404).json({ detail: `Submission with ID ${id} not found.`, status_code: 404 });
      return;
    }

    const orgFacts = store.facts
      .filter((f) => f.org_id === ctx.org.id)
      .map((f) => enrichFact(f, store.facts.filter((af) => af.org_id === ctx.org.id)));

    const textDrafts = await runPipeline(sub.content_text, orgFacts, ctx.org.settings?.enabled_rule_packs);
    const visionDrafts = sub.image_path ? analyzeAttachedImage(sub.image_path) : [];
    const allDrafts = [...textDrafts, ...visionDrafts];

    // Remove previous findings for this submission
    store.findings = store.findings.filter((f) => f.submission_id !== sub.id);
    const now = new Date().toISOString();
    const createdFindings: Finding[] = allDrafts.map((d) => {
      const f: Finding = {
        id: store.nextIds.finding++,
        org_id: ctx.org.id,
        submission_id: sub.id,
        version_number: sub.version,
        type: d.type,
        severity: d.severity,
        verdict: d.verdict,
        span_start: d.span_start,
        span_end: d.span_end,
        bbox: d.bbox,
        excerpt: d.excerpt,
        explanation: d.explanation,
        rule_id: d.rule_id,
        evidence_fact_id: d.evidence_fact_id,
        suggested_text: d.suggested_text,
        decision: 'pending',
        justification: null,
        created_at: now,
        category: d.category ?? null,
        confidence: d.confidence ?? 0.85,
        detected_by: d.detected_by ?? 'rule',
        pack: d.pack ?? null,
        rule_name: d.rule_name ?? null,
        why_hurts_trust: d.why_hurts_trust ?? null,
        needs_human: Boolean(d.needs_human),
      };
      store.findings.push(f);
      return f;
    });

    const score = calculateComplianceScore(createdFindings);
    const beforeStatus = sub.status;
    sub.status = 'ai_checked';
    sub.compliance_score = score;
    sub.updated_at = now;

    recordAuditEvent(
      store,
      ctx.org.id,
      { id: ctx.user.id, name: ctx.user.name, role: ctx.activeRole },
      'submission_ai_check',
      'submission',
      sub.id,
      { status: beforeStatus },
      { status: 'ai_checked', compliance_score: score, findings_count: createdFindings.length },
    );

    res.json(enrichSubmissionDetail(sub));
  });

  app.post('/api/submissions/:id/submit', (req, res) => {
    const ctx = resolveContext(req);
    const id = Number(req.params.id);
    const sub = store.submissions.find((s) => s.id === id && s.org_id === ctx.org.id);
    if (!sub) {
      res.status(404).json({ detail: `Submission with ID ${id} not found.`, status_code: 404 });
      return;
    }
    if (ctx.activeRole === 'employee' && sub.author_id !== ctx.user.id) {
      res.status(403).json({ detail: 'Forbidden: You can only submit your own drafts.', status_code: 403 });
      return;
    }
    if (sub.status !== 'ai_checked') {
      res.status(409).json({
        detail: `Cannot submit for review from status '${sub.status}'. Must be 'ai_checked'.`,
        status_code: 409,
      });
      return;
    }
    const subFindings = store.findings.filter((f) => f.submission_id === sub.id);
    const pending = subFindings.filter((f) => f.decision === 'pending');
    if (pending.length > 0) {
      res.status(400).json({
        detail: `Governance check failed: ${pending.length} findings are still pending. Every finding must be accepted or rejected before submission.`,
        status_code: 400,
      });
      return;
    }

    const beforeStatus = sub.status;
    sub.status = 'in_review';
    sub.updated_at = new Date().toISOString();

    recordAuditEvent(
      store,
      ctx.org.id,
      { id: ctx.user.id, name: ctx.user.name, role: ctx.activeRole },
      'submission_submitted',
      'submission',
      sub.id,
      { status: beforeStatus },
      { status: 'in_review' },
    );
    res.json(enrichSubmissionDetail(sub));
  });

  app.post('/api/submissions/:id/review', requireRole(['manager']), (req, res) => {
    const ctx = resolveContext(req);
    const id = Number(req.params.id);
    const sub = store.submissions.find((s) => s.id === id && s.org_id === ctx.org.id);
    if (!sub) {
      res.status(404).json({ detail: `Submission with ID ${id} not found.`, status_code: 404 });
      return;
    }

    const action = String(req.body?.action || '').trim().toLowerCase();
    if (!['approved', 'revision_requested'].includes(action)) {
      res.status(400).json({ detail: "Action must be either 'approved' or 'revision_requested'.", status_code: 400 });
      return;
    }

    if (sub.status !== 'in_review') {
      res.status(409).json({
        detail: `Cannot review submission in status '${sub.status}'. Must be 'in_review'.`,
        status_code: 409,
      });
      return;
    }

    const overrideReason = req.body?.override_reason ? String(req.body.override_reason).trim() : null;
    if (action === 'approved') {
      const subFindings = store.findings.filter((f) => f.submission_id === sub.id);
      const unresolvedEvidence = subFindings.filter(
        (f) => f.severity === 'high' && f.verdict === 'evidence_missing' && f.decision !== 'accepted',
      );
      if (unresolvedEvidence.length > 0 && !overrideReason) {
        const ids = unresolvedEvidence.map((f) => f.id);
        res.status(400).json({
          detail: `Governance block: Manager approval is blocked because high-severity evidence_missing finding(s) ${JSON.stringify(ids)} are unresolved without an approved fact. A recorded manager override reason is required to approve.`,
          status_code: 400,
        });
        return;
      }
    }

    const beforeStatus = sub.status;
    sub.status = action;
    sub.updated_at = new Date().toISOString();

    const review: Review = {
      id: store.nextIds.review++,
      org_id: ctx.org.id,
      submission_id: sub.id,
      reviewer_id: ctx.user.id,
      action,
      comment: req.body?.comment ? String(req.body.comment) : null,
      override_reason: overrideReason,
      created_at: new Date().toISOString(),
    };
    store.reviews.push(review);

    recordAuditEvent(
      store,
      ctx.org.id,
      { id: ctx.user.id, name: ctx.user.name, role: ctx.activeRole },
      `manager_review_${action}`,
      'submission',
      sub.id,
      { status: beforeStatus },
      { status: action, comment: review.comment, override_reason: overrideReason },
    );

    res.json(enrichSubmissionDetail(sub));
  });

  app.post('/api/submissions/:id/enhance', (req, res) => {
    const ctx = resolveContext(req);
    const id = Number(req.params.id);
    const sub = store.submissions.find((s) => s.id === id && s.org_id === ctx.org.id);
    if (!sub) {
      res.status(404).json({ detail: 'Submission not found', status_code: 404 });
      return;
    }
    const orgRawFacts = store.facts.filter((f) => f.org_id === ctx.org.id);
    const orgFacts = orgRawFacts.map((f) => enrichFact(f, orgRawFacts));
    const subFindings = store.findings.filter((f) => f.submission_id === sub.id);
    res.json(generateEnhancementOptions(sub, subFindings, orgFacts));
  });

  // ===========================================================================
  // FINDINGS ROUTE
  // ===========================================================================
  app.patch('/api/findings/:id', (req, res) => {
    const ctx = resolveContext(req);
    const id = Number(req.params.id);
    const finding = store.findings.find((f) => f.id === id && f.org_id === ctx.org.id);
    if (!finding) {
      res.status(404).json({ detail: `Finding with ID ${id} not found.`, status_code: 404 });
      return;
    }

    const decision = String(req.body?.decision || '').trim().toLowerCase();
    if (!['accepted', 'rejected'].includes(decision)) {
      res.status(400).json({ detail: "Decision must be either 'accepted' or 'rejected'.", status_code: 400 });
      return;
    }

    const justification = req.body?.justification ? String(req.body.justification).trim() : null;
    if (finding.severity === 'high' && decision === 'rejected' && !justification) {
      res.status(422).json({
        detail: 'Governance requirement: Rejecting a high-severity finding requires a written justification.',
        status_code: 422,
      });
      return;
    }

    const before = { decision: finding.decision, justification: finding.justification };
    finding.decision = decision;
    finding.justification = justification;

    const sub = store.submissions.find((s) => s.id === finding.submission_id);
    if (sub) {
      const subFindings = store.findings.filter((f) => f.submission_id === sub.id);
      sub.compliance_score = calculateComplianceScore(subFindings);
      sub.updated_at = new Date().toISOString();
    }

    recordAuditEvent(
      store,
      ctx.org.id,
      { id: ctx.user.id, name: ctx.user.name, role: ctx.activeRole },
      'finding_decision',
      'finding',
      finding.id,
      before,
      { decision: finding.decision, justification: finding.justification },
    );

    res.json(finding);
  });

  // ===========================================================================
  // AUDIT TRAIL ROUTE (APPEND-ONLY)
  // ===========================================================================
  app.get('/api/audit', (req, res) => {
    const ctx = resolveContext(req);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 50)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    let events = store.auditEvents.filter((e) => e.org_id === ctx.org.id);
    if (req.query.actor_id) events = events.filter((e) => e.actor_id === Number(req.query.actor_id));
    if (req.query.action) events = events.filter((e) => e.action === String(req.query.action));
    if (req.query.entity_type) events = events.filter((e) => e.entity_type === String(req.query.entity_type));

    events = [...events]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(offset, offset + limit);

    res.json(events);
  });

  // ===========================================================================
  // ANALYTICS ROUTE
  // ===========================================================================
  app.get('/api/analytics/summary', (req, res) => {
    const ctx = resolveContext(req);
    res.json(getAnalyticsSummary(store, ctx.org.id));
  });

  // ===========================================================================
  // FEEDBACK & ONBOARDING ROUTES
  // ===========================================================================
  app.post('/api/feedback/wrong-flag', (req, res) => {
    const ctx = resolveContext(req);
    const findingId = req.body?.finding_id ? Number(req.body.finding_id) : null;
    if (findingId && !store.findings.some((f) => f.id === findingId && f.org_id === ctx.org.id)) {
      res.status(404).json({ detail: `Finding #${findingId} not found.`, status_code: 404 });
      return;
    }
    const report = {
      id: store.nextIds.feedback++,
      org_id: ctx.org.id,
      finding_id: findingId,
      user_id: ctx.user.id,
      comment: String(req.body?.comment || '').trim(),
      proposed_correction: req.body?.proposed_correction ? String(req.body.proposed_correction).trim() : null,
      created_at: new Date().toISOString(),
    };
    store.feedbackReports.push(report);
    res.status(201).json({
      id: report.id,
      status: 'received',
      message: 'Feedback logged successfully for engine accuracy evaluation.',
      created_at: report.created_at,
    });
  });

  app.get('/api/onboarding/rule-packs', (req, res) => {
    const ctx = resolveContext(req);
    const packs = getAvailablePackNames();
    res.json({
      available_packs: packs.map((p) => ({ id: p, name: p.replace(/_/g, ' ').toUpperCase() })),
      enabled_packs: ctx.org.settings.enabled_rule_packs || packs,
    });
  });

  app.put('/api/onboarding/rule-packs', requireRole(['admin']), (req, res) => {
    const ctx = resolveContext(req);
    const packs = Array.isArray(req.body?.enabled_rule_packs) ? req.body.enabled_rule_packs.map(String) : [];
    ctx.org.settings.enabled_rule_packs = packs;
    res.json({
      available_packs: getAvailablePackNames().map((p) => ({ id: p, name: p.replace(/_/g, ' ').toUpperCase() })),
      enabled_packs: packs,
    });
  });

  // ===========================================================================
  // VITE / STATIC SPA SERVING
  // ===========================================================================
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(`Inkloom AI server running at http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Inkloom AI server:', err);
  process.exit(1);
});
