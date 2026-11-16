import React, { useState } from 'react';
import { BookOpen, FileText, CheckCircle2, AlertCircle, Clock, Upload, Plus, Eye, Sparkles, Shield, Palette } from 'lucide-react';
import { api } from '../services/api';

export const BrandLibraryPage = ({
  brand,
  facts = [],
  rules = [],
  guidelines = [],
  onRefresh,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState('facts'); // facts | rules | guidelines | brand
  const [rulePackFilter, setRulePackFilter] = useState('all'); // all | india_ad_code | brand_voice | visual_design

  // New Fact Modal State
  const [isAddingFact, setIsAddingFact] = useState(false);
  const [newFact, setNewFact] = useState({ statement: '', source: '', valid_until: '2028-12-31' });

  // Guideline Upload State
  const [uploadTitle, setUploadTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Suggested Rules extraction state
  const [extractedRules, setExtractedRules] = useState(null);
  const [selectedGuidelineId, setSelectedGuidelineId] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const handleCreateFact = async (e) => {
    e.preventDefault();
    try {
      await api.facts.create(newFact);
      onShowToast('Approved Fact created successfully', 'success');
      setIsAddingFact(false);
      setNewFact({ statement: '', source: '', valid_until: '2028-12-31' });
      onRefresh();
    } catch (err) {
      onShowToast(err.message || 'Failed to create fact', 'error');
    }
  };

  const handleUploadGuideline = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      onShowToast('Please select a file to upload', 'error');
      return;
    }
    setIsUploading(true);
    try {
      await api.guidelines.upload(uploadTitle || selectedFile.name, selectedFile);
      onShowToast('Guideline uploaded and indexed via PyMuPDF', 'success');
      setUploadTitle('');
      setSelectedFile(null);
      onRefresh();
    } catch (err) {
      onShowToast(err.message || 'Failed to upload guideline', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleExtractRules = async (guidelineId) => {
    setIsExtracting(true);
    setSelectedGuidelineId(guidelineId);
    try {
      const res = await api.guidelines.extractRules(guidelineId);
      setExtractedRules(res.suggested_rules || []);
      onShowToast('Rules successfully extracted from guideline', 'success');
    } catch (err) {
      onShowToast(err.message || 'Rule extraction failed', 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleApproveExtractedRules = async () => {
    if (!extractedRules || !selectedGuidelineId) return;
    try {
      await api.guidelines.approveRules(selectedGuidelineId, extractedRules);
      onShowToast(`${extractedRules.length} rules approved into Brand Library!`, 'success');
      setExtractedRules(null);
      setSelectedGuidelineId(null);
      onRefresh();
    } catch (err) {
      onShowToast(err.message || 'Failed to approve rules', 'error');
    }
  };

  const filteredRules = rules.filter((r) => {
    if (rulePackFilter === 'all') return true;
    return r.pack === rulePackFilter;
  });

  const getExpiryBadge = (fact) => {
    if (fact.is_expired) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#D9534F]/15 text-[#a8322e] border border-[#D9534F]/30">
          <AlertCircle className="w-3 h-3" /> Expired
        </span>
      );
    }
    if (fact.is_superseded) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E0A030]/15 text-[#9e6f1c] border border-[#E0A030]/30">
          <Clock className="w-3 h-3" /> Superseded
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#2E9E6B]/15 text-[#1e6d49] border border-[#2E9E6B]/30">
        <CheckCircle2 className="w-3 h-3" /> Current
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="pb-4 border-b border-[#E7E2D6] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="caps-label">Brand Governance</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-deepTeal">Brand Library & Guardrails</h1>
          <p className="text-sm text-gray-600 mt-1">
            Admin repository of approved clinical facts, India ad rules, guidelines, and design tokens.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-cream p-1 rounded-xl border border-[#E0DACE] shadow-inner">
          <button
            onClick={() => setActiveTab('facts')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'facts' ? 'bg-deepTeal text-white shadow-sm' : 'text-gray-600 hover:text-deepTeal'
            }`}
          >
            Approved Facts ({facts.length})
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'rules' ? 'bg-deepTeal text-white shadow-sm' : 'text-gray-600 hover:text-deepTeal'
            }`}
          >
            Rules ({rules.length})
          </button>
          <button
            onClick={() => setActiveTab('guidelines')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'guidelines' ? 'bg-deepTeal text-white shadow-sm' : 'text-gray-600 hover:text-deepTeal'
            }`}
          >
            Guidelines ({guidelines.length})
          </button>
          <button
            onClick={() => setActiveTab('brand')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'brand' ? 'bg-deepTeal text-white shadow-sm' : 'text-gray-600 hover:text-deepTeal'
            }`}
          >
            Brand Assets
          </button>
        </div>
      </div>

      {/* TAB 1: APPROVED FACTS */}
      {activeTab === 'facts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-deepTeal">Approved Facts Dossier</h2>
              <p className="text-xs text-gray-500">Every marketing claim is checked against these verified statements.</p>
            </div>
            <button
              onClick={() => setIsAddingFact(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal hover:bg-teal-dark text-white rounded-xl text-xs font-bold shadow-soft transition-all"
            >
              <Plus className="w-4 h-4" /> Add Fact
            </button>
          </div>

          {/* Add Fact Form */}
          {isAddingFact && (
            <form onSubmit={handleCreateFact} className="bg-warmWhite p-5 rounded-2xl border border-teal/40 shadow-soft space-y-4">
              <h3 className="text-sm font-bold text-deepTeal">Add New Approved Fact</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Approved Statement</label>
                  <textarea
                    rows={2}
                    required
                    value={newFact.statement}
                    onChange={(e) => setNewFact({ ...newFact, statement: e.target.value })}
                    placeholder="e.g. Clinically proven to reduce inflammatory acne lesions by up to 42% after 6 weeks..."
                    className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal/30 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Source Dossier / Trial</label>
                    <input
                      type="text"
                      required
                      value={newFact.source}
                      onChange={(e) => setNewFact({ ...newFact, source: e.target.value })}
                      placeholder="e.g. Trial GL-CT-2024-B, n=60 participants"
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal/30 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Valid Until</label>
                    <input
                      type="date"
                      value={newFact.valid_until}
                      onChange={(e) => setNewFact({ ...newFact, valid_until: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal/30 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingFact(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-deepTeal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal text-white rounded-xl text-xs font-bold hover:bg-teal-dark"
                >
                  Save Fact
                </button>
              </div>
            </form>
          )}

          {/* Facts Table */}
          <div className="bg-warmWhite rounded-2xl border border-[#E7E2D6] shadow-soft overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream/60 border-b border-[#E7E2D6] text-xs font-bold text-gray-600 uppercase">
                <tr>
                  <th className="px-6 py-3.5">ID</th>
                  <th className="px-6 py-3.5">Verified Statement</th>
                  <th className="px-6 py-3.5">Source Dossier</th>
                  <th className="px-6 py-3.5">Ver</th>
                  <th className="px-6 py-3.5">Valid Until</th>
                  <th className="px-6 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE5D9]">
                {facts.map((fact) => (
                  <tr key={fact.id} className="hover:bg-cream/40">
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">#{fact.id}</td>
                    <td className="px-6 py-4 text-xs font-medium text-deepTeal max-w-md">
                      {fact.statement}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 max-w-xs truncate">
                      {fact.source}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-teal">v{fact.version}</td>
                    <td className="px-6 py-4 text-xs text-gray-600 font-mono">
                      {fact.valid_until || 'Indefinite'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {getExpiryBadge(fact)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-deepTeal">Brand & Regulatory Guardrails</h2>
              <p className="text-xs text-gray-500">
                Rule packs inspired by the ASCI Code and CCPA 2022 guidelines. Checklist aid, not legal advice.
              </p>
            </div>

            {/* Pack filter toggles */}
            <div className="flex items-center gap-1.5 bg-cream p-1 rounded-xl border border-[#E0DACE] text-xs">
              <button
                onClick={() => setRulePackFilter('all')}
                className={`px-3 py-1 rounded-lg font-semibold ${rulePackFilter === 'all' ? 'bg-deepTeal text-white' : 'text-gray-600'}`}
              >
                All ({rules.length})
              </button>
              <button
                onClick={() => setRulePackFilter('india_ad_code')}
                className={`px-3 py-1 rounded-lg font-semibold ${rulePackFilter === 'india_ad_code' ? 'bg-deepTeal text-white' : 'text-gray-600'}`}
              >
                India Ad Code (ASCI)
              </button>
              <button
                onClick={() => setRulePackFilter('brand_voice')}
                className={`px-3 py-1 rounded-lg font-semibold ${rulePackFilter === 'brand_voice' ? 'bg-deepTeal text-white' : 'text-gray-600'}`}
              >
                Brand Voice
              </button>
            </div>
          </div>

          <div className="bg-warmWhite rounded-2xl border border-[#E7E2D6] shadow-soft overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream/60 border-b border-[#E7E2D6] text-xs font-bold text-gray-600 uppercase">
                <tr>
                  <th className="px-6 py-3.5">Rule Title</th>
                  <th className="px-6 py-3.5">Pack</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Severity</th>
                  <th className="px-6 py-3.5">Description & Disclaimer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE5D9]">
                {filteredRules.map((r) => (
                  <tr key={r.id} className="hover:bg-cream/40">
                    <td className="px-6 py-4 font-bold text-xs text-deepTeal max-w-xs">{r.title}</td>
                    <td className="px-6 py-4 text-xs font-mono text-teal">
                      {r.pack === 'india_ad_code' ? 'India Ad Pack' : r.pack}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 uppercase font-semibold">{r.type}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                        r.severity === 'high' ? 'bg-coral/15 text-coral' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {r.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 max-w-md">
                      <p>{r.description}</p>
                      <span className="text-[10px] text-gray-400 italic mt-1 block">
                        {r.disclaimer || 'Checklist aid, not legal advice.'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: GUIDELINES UPLOAD */}
      {activeTab === 'guidelines' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Box */}
          <div className="bg-warmWhite p-6 rounded-2xl border border-[#E7E2D6] shadow-soft space-y-4">
            <div>
              <span className="caps-label">PyMuPDF Document Ingest</span>
              <h2 className="text-base font-bold text-deepTeal mt-0.5">Upload Guidelines (PDF / TXT)</h2>
              <p className="text-xs text-gray-500 mt-1">
                Upload brand guides or regulatory memos. Backend automatically extracts clean text.
              </p>
            </div>

            <form onSubmit={handleUploadGuideline} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. GlowLeaf Monsoon Guidelines 2026"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal/30 focus:outline-none"
                />
              </div>

              <div className="border-2 border-dashed border-[#CCD8D6] rounded-xl p-6 text-center hover:bg-cream/40 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept=".pdf,.txt"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-8 h-8 text-teal mx-auto mb-2" />
                <span className="text-xs font-bold text-deepTeal block">
                  {selectedFile ? selectedFile.name : 'Choose PDF or TXT guideline'}
                </span>
                <span className="text-[11px] text-gray-400 block mt-1">Max 10MB per document</span>
              </div>

              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-2.5 bg-teal hover:bg-teal-dark text-white rounded-xl text-xs font-bold shadow-soft transition-all disabled:opacity-50"
              >
                {isUploading ? 'Extracting & Indexing...' : 'Upload & Process'}
              </button>
            </form>
          </div>

          {/* Existing Documents List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-base font-bold text-deepTeal">Indexed Guidelines</h2>
            <div className="space-y-3">
              {guidelines.map((g) => (
                <div key={g.id} className="bg-warmWhite p-5 rounded-2xl border border-[#E7E2D6] shadow-soft space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-teal" />
                      <h3 className="text-sm font-bold text-deepTeal">{g.title}</h3>
                      <span className="text-xs text-gray-400 font-mono">({g.filename})</span>
                    </div>
                    <button
                      onClick={() => handleExtractRules(g.id)}
                      disabled={isExtracting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-mint hover:bg-mint/70 text-deepTeal rounded-xl text-xs font-bold border border-teal/20 transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-teal" />
                      <span>Extract Rules</span>
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-3 bg-cream/50 p-2.5 rounded-xl font-mono">
                    {g.content_text}
                  </p>
                </div>
              ))}
            </div>

            {/* Extracted Rules Approval Modal / Panel */}
            {extractedRules && (
              <div className="bg-mint/40 p-5 rounded-2xl border border-teal/30 shadow-soft space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-teal" />
                    <h3 className="text-sm font-bold text-deepTeal">AI-Suggested Rules for Approval</h3>
                  </div>
                  <button
                    onClick={handleApproveExtractedRules}
                    className="px-4 py-1.5 bg-teal text-white rounded-xl text-xs font-bold hover:bg-teal-dark shadow-sm"
                  >
                    Approve All {extractedRules.length} Rules
                  </button>
                </div>
                <div className="space-y-2">
                  {extractedRules.map((rule, idx) => (
                    <div key={idx} className="bg-warmWhite p-3 rounded-xl border border-teal/20 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-deepTeal">{rule.title}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cream text-teal border border-teal/20">
                          {rule.type} · {rule.severity}
                        </span>
                      </div>
                      <p className="text-gray-600">{rule.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: BRAND ASSETS */}
      {activeTab === 'brand' && (
        <div className="bg-warmWhite p-6 rounded-2xl border border-[#E7E2D6] shadow-soft space-y-6">
          <div>
            <span className="caps-label">Brand Identity</span>
            <h2 className="text-xl font-extrabold text-deepTeal">{brand?.name || 'GlowLeaf'}</h2>
            <p className="text-sm text-gray-600">{brand?.tagline || 'Pure Botanical Radiance, Backed by Science'}</p>
          </div>

          {/* Palette Swatches */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal mb-3">Official Design Tokens</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { name: 'Cream', hex: '#F7F4EC', role: 'Page background' },
                { name: 'Warm White', hex: '#FFFDF9', role: 'Cards' },
                { name: 'Deep Teal', hex: '#133B3B', role: 'Text / dark' },
                { name: 'Teal', hex: '#1A6B66', role: 'Primary' },
                { name: 'Coral', hex: '#E8775D', role: 'Flags / Accent' },
                { name: 'Mint', hex: '#DCEEEB', role: 'Subtle fill' },
                { name: 'Blush', hex: '#FAE3DC', role: 'Warning light' },
              ].map((swatch) => (
                <div key={swatch.name} className="p-3 bg-cream rounded-xl border border-[#E0DACE] space-y-2">
                  <div className="w-full h-12 rounded-lg border border-black/5" style={{ backgroundColor: swatch.hex }} />
                  <div>
                    <span className="text-xs font-bold text-deepTeal block">{swatch.name}</span>
                    <span className="text-[10px] font-mono text-gray-500 block">{swatch.hex}</span>
                    <span className="text-[10px] text-gray-400 block">{swatch.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
