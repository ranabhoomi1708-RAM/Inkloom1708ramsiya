import React, { useState } from 'react';
import { Upload, Sparkles, AlertCircle, ArrowRight, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

export const NewSubmissionPage = ({ onSubmissionCreated, onShowToast }) => {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('Performance Marketing');
  const [contentText, setContentText] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState('');

  const loadDemoAd = () => {
    setTitle('GlowLeaf Monsoon Acne Hero Ad');
    setDepartment('Performance Marketing');
    setContentText('Removes 100% acne in 3 days with natural willow extract! The miracle overnight cure your skin has been waiting for.');
    setImagePath('/sample_data/demo_acne_ad.png');
    onShowToast('Loaded hero demo ad: "Removes 100% acne in 3 days."', 'info');
  };

  const handleSubmitAndCheck = async (e) => {
    e.preventDefault();
    if (!contentText.trim()) {
      onShowToast('Please provide text to verify', 'error');
      return;
    }

    setIsChecking(true);
    setCheckProgress('Creating draft submission...');

    try {
      // Step 1: Create draft submission
      const sub = await api.submissions.create({
        title: title || 'Untitled Campaign Copy',
        content_text: contentText,
        department: department,
        image_path: imagePath || null,
      });

      // Step 2: Animate checking stages for UI feedback
      setCheckProgress('Splitting sentences & extracting claims...');
      await new Promise(r => setTimeout(r, 400));
      setCheckProgress('Retrieving approved facts via TF-IDF & keyword entailment...');
      await new Promise(r => setTimeout(r, 400));
      setCheckProgress('Auditing India Ad Code (ASCI & CCPA 2022 guidelines)...');
      await new Promise(r => setTimeout(r, 400));
      setCheckProgress('Generating verified safe rewrites...');

      // Step 3: Run AI check endpoint
      const checkedSub = await api.submissions.check(sub.id);
      onShowToast(`Verification complete! Compliance score: ${checkedSub.compliance_score}`, 'success');

      // Navigate to Review screen
      onSubmissionCreated(checkedSub.id);
    } catch (err) {
      onShowToast(err.message || 'Check failed', 'error');
      setIsChecking(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E7E2D6]">
        <div>
          <span className="caps-label">Author & Creator Flow</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-deepTeal">New Content Verification</h1>
          <p className="text-sm text-gray-600 mt-1">
            Input marketing copy or ad creative for instant pre-publication evidence and rule checking.
          </p>
        </div>

        {/* Load Demo Ad Button */}
        <button
          type="button"
          onClick={loadDemoAd}
          className="flex items-center gap-2 px-3.5 py-2 bg-blush text-[#a8322e] hover:bg-blush/80 rounded-xl text-xs font-bold border border-coral/30 shadow-sm transition-all"
        >
          <Sparkles className="w-4 h-4 text-coral" />
          <span>Load Demo Ad</span>
        </button>
      </div>

      {/* Main Submission Form */}
      <form onSubmit={handleSubmitAndCheck} className="bg-warmWhite p-6 sm:p-8 rounded-2xl border border-[#E7E2D6] shadow-soft space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-teal mb-1.5">
              Campaign Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. GlowLeaf Clarifying Monsoon Ad"
              className="w-full text-sm p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal/30 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-teal mb-1.5">
              Department / Team
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full text-sm p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal/30 focus:outline-none bg-warmWhite"
            >
              <option value="Performance Marketing">Performance Marketing</option>
              <option value="Social Media & Ads">Social Media & Ads</option>
              <option value="Influencer Relations">Influencer Relations</option>
              <option value="Brand Marketing">Brand Marketing</option>
            </select>
          </div>
        </div>

        {/* Copy Text Area */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-teal mb-1.5">
            Ad Copy & Body Content
          </label>
          <textarea
            rows={5}
            required
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder="Type or paste the exact marketing text, caption, or headline..."
            className="w-full text-sm p-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal/30 focus:outline-none leading-relaxed"
          />
          <span className="text-[11px] text-gray-500 mt-1 block">
            AI checks all sentences for quantitative numbers, absolutes, India ad rules, and brand voice.
          </span>
        </div>

        {/* Drag & Drop Visual Creative Box */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-teal mb-1.5">
            Creative Asset (Optional Image/Banner)
          </label>
          <div className="border-2 border-dashed border-[#CCD8D6] rounded-xl p-6 text-center hover:bg-cream/40 transition-colors">
            <ImageIcon className="w-8 h-8 text-teal mx-auto mb-2" />
            <span className="text-xs font-bold text-deepTeal block">
              {imagePath ? `Attached: ${imagePath}` : 'Drag & drop banner creative or banner preview'}
            </span>
            <span className="text-[11px] text-gray-400 block mt-1">PNG, JPG or WebP (Contrast & logo clearspace checked)</span>
            {!imagePath && (
              <button
                type="button"
                onClick={() => setImagePath('/sample_data/demo_acne_ad.png')}
                className="mt-3 text-xs text-teal font-semibold underline hover:text-teal-dark"
              >
                Use sample acne banner (/sample_data/demo_acne_ad.png)
              </button>
            )}
          </div>
        </div>

        {/* Action Button & Progress */}
        <div className="pt-2">
          {isChecking ? (
            <div className="p-4 bg-mint/50 rounded-xl border border-teal/20 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-deepTeal font-bold text-sm">
                <Sparkles className="w-4 h-4 text-teal animate-spin" />
                <span>{checkProgress}</span>
              </div>
              <div className="w-full bg-cream h-2 rounded-full overflow-hidden">
                <div className="bg-teal h-full w-3/4 animate-pulse rounded-full" />
              </div>
            </div>
          ) : (
            <button
              type="submit"
              className="w-full py-3 bg-teal hover:bg-teal-dark text-white rounded-xl text-sm font-bold shadow-soft transition-all flex items-center justify-center gap-2"
            >
              <span>Run Verification Check</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
