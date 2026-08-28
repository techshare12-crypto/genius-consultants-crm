import React, { useState } from 'react';
import { candidatesApi } from '../../services/api';
import { Modal } from '../common/Modal';
import { UserPlus, AlertCircle } from 'lucide-react';

interface AddCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCandidateAdded: () => void;
}

export const AddCandidateModal: React.FC<AddCandidateModalProps> = ({
  isOpen,
  onClose,
  onCandidateAdded,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    primaryPhone: '',
    secondaryPhone: '',
    email: '',
    currentLocation: '',
    education: '',
    totalExperienceYears: '',
    currentCompany: '',
    currentSalary: '',
    expectedSalary: '',
    noticePeriod: 'Immediate',
    hasTwoWheeler: false,
    hasDrivingLicense: false,
    interestedInFieldSales: true,
    interestedInAutomobile: false,
    generalNotes: '',
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.primaryPhone) {
      setError('Candidate Name and Primary Contact Number are required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await candidatesApi.create(formData);
      onCandidateAdded();
      onClose();
      setFormData({
        name: '',
        primaryPhone: '',
        secondaryPhone: '',
        email: '',
        currentLocation: '',
        education: '',
        totalExperienceYears: '',
        currentCompany: '',
        currentSalary: '',
        expectedSalary: '',
        noticePeriod: 'Immediate',
        hasTwoWheeler: false,
        hasDrivingLicense: false,
        interestedInFieldSales: true,
        interestedInAutomobile: false,
        generalNotes: '',
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add candidate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={
        <div className="flex items-center gap-2 text-slate-900 font-bold">
          <UserPlus className="w-5 h-5 text-blue-600" />
          <span>Add New Candidate to Database</span>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Candidate Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Primary Contact Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              required
              placeholder="e.g. 9876543210"
              value={formData.primaryPhone}
              onChange={(e) => setFormData({ ...formData, primaryPhone: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              placeholder="candidate@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Current Location</label>
            <input
              type="text"
              placeholder="e.g. New Delhi, Noida, Mumbai"
              value={formData.currentLocation}
              onChange={(e) => setFormData({ ...formData, currentLocation: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Education / Degree</label>
            <input
              type="text"
              placeholder="e.g. Graduate (B.Com)"
              value={formData.education}
              onChange={(e) => setFormData({ ...formData, education: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Experience (Years)</label>
            <input
              type="number"
              step="0.5"
              placeholder="e.g. 2.5"
              value={formData.totalExperienceYears}
              onChange={(e) => setFormData({ ...formData, totalExperienceYears: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Current Company</label>
            <input
              type="text"
              placeholder="e.g. Maruti Suzuki / Zomato"
              value={formData.currentCompany}
              onChange={(e) => setFormData({ ...formData, currentCompany: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Salary (Take-home)</label>
            <input
              type="text"
              placeholder="e.g. ₹25,000 / month"
              value={formData.expectedSalary}
              onChange={(e) => setFormData({ ...formData, expectedSalary: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Eligibility Checkboxes */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="text-xs font-semibold text-slate-700">Eligibility & Assets:</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.hasTwoWheeler}
                onChange={(e) => setFormData({ ...formData, hasTwoWheeler: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span>Two-Wheeler</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.hasDrivingLicense}
                onChange={(e) => setFormData({ ...formData, hasDrivingLicense: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span>Driving License</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.interestedInFieldSales}
                onChange={(e) => setFormData({ ...formData, interestedInFieldSales: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span>Field Sales</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.interestedInAutomobile}
                onChange={(e) => setFormData({ ...formData, interestedInAutomobile: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span>Automobile</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">General Remarks / Notes</label>
          <textarea
            rows={2}
            placeholder="Candidate notes, interview availability..."
            value={formData.generalNotes}
            onChange={(e) => setFormData({ ...formData, generalNotes: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Add Candidate'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
