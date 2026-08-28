import React, { useState, useEffect } from 'react';
import { registrationsApi } from '../services/api';
import {
  User,
  Briefcase,
  GraduationCap,
  Sparkles,
  MapPin,
  CheckCircle2,
  UploadCloud,
  FileText,
  AlertCircle,
  Save,
  ArrowRight,
  ArrowLeft,
  Clock,
  ShieldCheck,
  Building2,
} from 'lucide-react';

interface PublicRegistrationPortalProps {
  token: string;
}

export const PublicRegistrationPortal: React.FC<PublicRegistrationPortalProps> = ({ token }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [session, setSession] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [step, setStep] = useState<number>(1);
  const [savingDraft, setSavingDraft] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedSuccess, setSubmittedSuccess] = useState<boolean>(false);
  const [uploadingCv, setUploadingCv] = useState<boolean>(false);
  const [uploadedDocInfo, setUploadedDocInfo] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState<any>({
    // Step 1: Personal
    name: '',
    primaryPhone: '',
    whatsappNumber: '',
    email: '',
    currentCity: '',
    currentAddress: '',
    dateOfBirth: '',
    gender: 'MALE',

    // Step 2: Professional
    employmentStatus: 'EMPLOYED',
    currentCompany: '',
    currentDesignation: '',
    totalExperience: '2',
    relevantExperience: '2',
    currentSalary: '25,000 / month',
    expectedSalary: '30,000 / month',
    noticePeriod: '15 Days',

    // Step 3: Education
    qualification: 'Graduate / Bachelor Degree',
    institution: '',
    universityOrBoard: '',
    yearOfPassing: '2023',
    percentageOrCgpa: '72%',

    // Step 4: Skills
    skills: 'Customer Relationship, Automobile Sales, Lead Followup',
    languages: 'English, Hindi',
    technicalSkills: 'MS Excel, CRM Software, ERP',
    certifications: '',

    // Step 5: Preferences
    preferredRole: 'Showroom Sales Advisor / Executive',
    preferredLocations: 'Delhi NCR, Gurugram, Noida',
    willingToRelocate: true,
    employmentType: 'FULL_TIME',

    // Step 6: Eligibility
    hasTwoWheeler: true,
    hasDrivingLicense: true,
    interestedInFieldSales: true,
    interestedInAutomobile: true,
  });

  // Load session from token
  useEffect(() => {
    async function loadRegistrationContext() {
      setLoading(true);
      try {
        const res = await registrationsApi.publicGet(token);
        setSession(res.data);
        if (res.data.candidate) {
          setFormData((prev: any) => ({
            ...prev,
            name: res.data.candidate.name || '',
            primaryPhone: res.data.candidate.primaryPhone || '',
            email: res.data.candidate.email || '',
            currentCity: res.data.candidate.currentLocation || '',
            whatsappNumber: res.data.candidate.primaryPhone || '',
          }));
        }

        if (res.data.draftData) {
          setFormData((prev: any) => ({ ...prev, ...res.data.draftData }));
        }

        if (res.data.stepCompleted) {
          setStep(Math.min(res.data.stepCompleted, 7));
        }

        if (res.data.status === 'SUBMITTED' || res.data.status === 'APPROVED') {
          setSubmittedSuccess(true);
        }
      } catch (err: any) {
        setErrorMsg(err.response?.data?.error || 'Invalid or expired registration session link');
      } finally {
        setLoading(false);
      }
    }
    loadRegistrationContext();
  }, [token]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      await registrationsApi.publicSaveDraft(token, {
        stepCompleted: step,
        draftData: formData,
      });
      alert('Your progress has been saved! You can resume using this link anytime.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save draft progress');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    setUploadingCv(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await registrationsApi.publicUploadCv(token, form);
      setUploadedDocInfo(res.data);
      alert(`CV "${res.data.originalFileName}" (v${res.data.versionNumber}) uploaded successfully!`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to upload CV');
    } finally {
      setUploadingCv(false);
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await registrationsApi.publicSubmit(token, {
        submittedData: formData,
      });
      setSubmittedSuccess(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit registration');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-white space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="font-bold text-sm">Loading Registration Portal...</div>
          <div className="text-xs text-slate-400">Genius Consultants Verification System</div>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-xs">
        <div className="max-w-md w-full p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-white">Registration Link Inaccessible</h2>
          <p className="text-slate-400 leading-relaxed">{errorMsg}</p>
          <div className="p-3 bg-slate-800/80 rounded-xl text-slate-300 text-[11px]">
            Please contact your Genius Consultants executive or recruitment team leader for a fresh verification link.
          </div>
        </div>
      </div>
    );
  }

  if (submittedSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-xs">
        <div className="max-w-md w-full p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-5 shadow-2xl animate-fade-in">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 font-bold text-[11px] border border-emerald-500/20">
              Registration Completed & Submitted
            </span>
            <h2 className="text-xl font-black text-white mt-3">Profile Received Successfully!</h2>
            <p className="text-slate-400 mt-1 leading-relaxed">
              Thank you, <strong className="text-white">{formData.name}</strong>. Your candidate details and CV have been securely submitted to Genius Consultants.
            </p>
          </div>

          <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/50 text-left space-y-2">
            <div className="flex justify-between items-center text-slate-300">
              <span>Status:</span>
              <span className="font-bold text-amber-400 font-mono">UNDER REVIEW</span>
            </div>
            {session?.jobOrder && (
              <div className="flex justify-between items-center text-slate-300">
                <span>Applied For:</span>
                <span className="font-bold text-white">{session.jobOrder.jobTitle}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-slate-300">
              <span>Candidate Phone:</span>
              <span className="font-mono text-slate-200">{formData.primaryPhone}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Our talent acquisition specialist will review your submitted profile and contact you regarding interview scheduling.
          </p>
        </div>
      </div>
    );
  }

  const progressPercent = Math.round((step / 7) * 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Header */}
      <div className="max-w-2xl w-full mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-sm shadow-md shadow-blue-500/30">
              GC
            </div>
            <div>
              <div className="font-black text-xs tracking-wide uppercase text-white">Genius Consultants</div>
              <div className="text-[10px] text-slate-400">Candidate Onboarding & Verification Portal</div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition"
          >
            <Save className="w-3.5 h-3.5 text-blue-400" />
            <span>{savingDraft ? 'Saving...' : 'Save Draft'}</span>
          </button>
        </div>

        {/* Job Banner if attached */}
        {session?.jobOrder && (
          <div className="p-3 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900/40 border border-blue-500/30 rounded-2xl flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-blue-300 font-bold uppercase">Applying for Position</span>
              <div className="font-bold text-white">{session.jobOrder.jobTitle}</div>
              <div className="text-[11px] text-slate-400">{session.jobOrder.companyName} • {session.jobOrder.location}</div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 font-bold text-[11px] border border-blue-500/30">
              {session.jobOrder.salaryRange}
            </span>
          </div>
        )}

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-bold text-slate-400">
            <span>STEP {step} OF 7</span>
            <span className="text-blue-400">{progressPercent}% Completed</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Multi-Step Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
          {/* STEP 1: PERSONAL DETAILS */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <User className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Step 1: Personal & Contact Details</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Primary Mobile Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.primaryPhone}
                    onChange={(e) => handleInputChange('primaryPhone', e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    value={formData.whatsappNumber}
                    onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Current City / Location *</label>
                  <input
                    type="text"
                    required
                    value={formData.currentCity}
                    onChange={(e) => handleInputChange('currentCity', e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PROFESSIONAL DETAILS */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Briefcase className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Step 2: Professional & Work Experience</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Current Employment Status</label>
                  <select
                    value={formData.employmentStatus}
                    onChange={(e) => handleInputChange('employmentStatus', e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="EMPLOYED">Currently Working / Employed</option>
                    <option value="UNEMPLOYED">Immediate Available / Serving Notice</option>
                    <option value="FRESHER">Fresher</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Current / Last Company</label>
                  <input
                    type="text"
                    value={formData.currentCompany}
                    onChange={(e) => handleInputChange('currentCompany', e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Current Designation / Role</label>
                  <input
                    type="text"
                    value={formData.currentDesignation}
                    onChange={(e) => handleInputChange('currentDesignation', e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Total Experience (Years)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.totalExperience}
                    onChange={(e) => handleInputChange('totalExperience', e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Current Salary (CTC / Monthly)</label>
                  <input
                    type="text"
                    value={formData.currentSalary}
                    onChange={(e) => handleInputChange('currentSalary', e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Expected Salary (CTC / Monthly)</label>
                  <input
                    type="text"
                    value={formData.expectedSalary}
                    onChange={(e) => handleInputChange('expectedSalary', e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: EDUCATION */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <GraduationCap className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Step 3: Educational Qualifications</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Highest Qualification *</label>
                  <select
                    value={formData.qualification}
                    onChange={(e) => handleInputChange('qualification', e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="Post Graduate / Master">Post Graduate / Master</option>
                    <option value="Graduate / Bachelor Degree">Graduate / Bachelor Degree</option>
                    <option value="Diploma / Polytechnic">Diploma / Polytechnic</option>
                    <option value="12th Pass / Higher Secondary">12th Pass / Higher Secondary</option>
                    <option value="10th Pass / Secondary">10th Pass / Secondary</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">College / Institution Name</label>
                  <input
                    type="text"
                    value={formData.institution}
                    onChange={(e) => handleInputChange('institution', e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Year of Passing</label>
                  <input
                    type="text"
                    value={formData.yearOfPassing}
                    onChange={(e) => handleInputChange('yearOfPassing', e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Percentage / CGPA</label>
                  <input
                    type="text"
                    value={formData.percentageOrCgpa}
                    onChange={(e) => handleInputChange('percentageOrCgpa', e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SKILLS & LANGUAGES */}
          {step === 4 && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Step 4: Key Skills & Languages Known</h3>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Key Professional Skills *</label>
                  <input
                    type="text"
                    value={formData.skills}
                    onChange={(e) => handleInputChange('skills', e.target.value)}
                    placeholder="e.g. Sales, Negotiation, Showroom Management, Client Pitching"
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Languages Known</label>
                  <input
                    type="text"
                    value={formData.languages}
                    onChange={(e) => handleInputChange('languages', e.target.value)}
                    placeholder="e.g. Hindi, English, Punjabi"
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Technical Skills & Software Tools</label>
                  <input
                    type="text"
                    value={formData.technicalSkills}
                    onChange={(e) => handleInputChange('technicalSkills', e.target.value)}
                    placeholder="e.g. MS Office, Salesforce CRM, Dealer Management System (DMS)"
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: JOB PREFERENCES */}
          {step === 5 && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <MapPin className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Step 5: Job & Location Preferences</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Preferred Job Title / Role</label>
                  <input
                    type="text"
                    value={formData.preferredRole}
                    onChange={(e) => handleInputChange('preferredRole', e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Preferred Job Cities</label>
                  <input
                    type="text"
                    value={formData.preferredLocations}
                    onChange={(e) => handleInputChange('preferredLocations', e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: ELIGIBILITY */}
          {step === 6 && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Step 6: Operational Eligibility Checks</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="p-3 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-between cursor-pointer">
                  <span className="font-semibold text-slate-200">Have Own Two-Wheeler / Bike</span>
                  <input
                    type="checkbox"
                    checked={formData.hasTwoWheeler}
                    onChange={(e) => handleInputChange('hasTwoWheeler', e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                </label>

                <label className="p-3 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-between cursor-pointer">
                  <span className="font-semibold text-slate-200">Have Valid Driving License</span>
                  <input
                    type="checkbox"
                    checked={formData.hasDrivingLicense}
                    onChange={(e) => handleInputChange('hasDrivingLicense', e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                </label>

                <label className="p-3 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-between cursor-pointer">
                  <span className="font-semibold text-slate-200">Interested in Automobile Dealerships</span>
                  <input
                    type="checkbox"
                    checked={formData.interestedInAutomobile}
                    onChange={(e) => handleInputChange('interestedInAutomobile', e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                </label>

                <label className="p-3 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-between cursor-pointer">
                  <span className="font-semibold text-slate-200">Open for Field Sales & Customer Visits</span>
                  <input
                    type="checkbox"
                    checked={formData.interestedInFieldSales}
                    onChange={(e) => handleInputChange('interestedInFieldSales', e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                </label>
              </div>
            </div>
          )}

          {/* STEP 7: DOCUMENTS & CV UPLOAD */}
          {step === 7 && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <UploadCloud className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Step 7: Upload Resume / CV</h3>
              </div>

              <div className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-6 text-center bg-slate-800/40 relative cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.png"
                  onChange={handleCvUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-2 pointer-events-none">
                  <UploadCloud className="w-8 h-8 text-blue-400 mx-auto" />
                  <div className="font-bold text-white">
                    {uploadingCv ? 'Uploading CV with version control...' : 'Click to Upload Resume (PDF, DOCX)'}
                  </div>
                  {uploadedDocInfo && (
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-[11px]">
                      ✓ {uploadedDocInfo.originalFileName} (Version v{uploadedDocInfo.versionNumber}) Attached
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
            ) : <div />}

            {step < 7 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-lg shadow-blue-500/20 active:scale-95"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Submitting Profile...' : 'Complete & Submit Profile'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] text-slate-500 py-4">
        © 2026 Genius Consultants Limited • Permanent Candidate UUID Security Protected
      </div>
    </div>
  );
};
