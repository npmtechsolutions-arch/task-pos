/**
 * HrApprovalPage — opened when Super Admin clicks an HR notification.
 * Routes:
 *   /hr/approval/hire/:id
 *   /hr/approval/fire/:id
 *   /hr/approval/intern/:id
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, CheckCircle, XCircle, Loader2, User, Briefcase,
  Calendar, Mail, Building, Clock, FileText, ExternalLink,
  GraduationCap, AlertTriangle, UserMinus,
} from 'lucide-react';
import { useUIStore, useAuthStore } from '@/stores';
import { cn } from '@/lib/utils';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const auth = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || localStorage.getItem('access_token')}`,
});

type FlowType = 'hire' | 'fire' | 'intern';

// ── PDF Viewer ──────────────────────────────────────────────────────────────
function PdfViewer({ url }: { url: string }) {
  const isGoogleDrive = url.includes('drive.google.com');
  const embedUrl = isGoogleDrive
    ? url.replace('/view', '/preview').replace('/edit', '/preview')
    : url;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <FileText className="w-4 h-4 text-indigo-500" /> Resume / Document
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
          <ExternalLink className="w-3.5 h-3.5" /> Open full screen
        </a>
      </div>
      <iframe
        src={embedUrl}
        title="Document Preview"
        className="w-full h-[500px]"
        allow="autoplay"
      />
    </div>
  );
}

// ── Reject Modal ────────────────────────────────────────────────────────────
function RejectModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-red-600 mb-1">Confirm Rejection</h3>
        <p className="text-sm text-gray-500 mb-4">Provide an optional reason for the HR team.</p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason (optional)"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 mb-4"
        />
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => onConfirm(reason)}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2 text-sm font-semibold">
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Info Row ────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-indigo-600" />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-gray-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ── Hire Detail ─────────────────────────────────────────────────────────────
function HireDetail({ data, onApprove, onReject, acting }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
          <User className="w-4 h-4 text-emerald-500" /> Candidate Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InfoRow icon={User} label="Full Name" value={data.name} />
          <InfoRow icon={Mail} label="Personal Email" value={data.email} />
          <InfoRow icon={Briefcase} label="Job Title" value={data.job_title} />
          <InfoRow icon={User} label="System Role" value={data.role} />
          <InfoRow icon={Calendar} label="Joining Date"
            value={data.join_date ? new Date(data.join_date).toLocaleDateString('en-US', { dateStyle: 'long' }) : null} />
        </div>
      </div>

      {data.resume_url && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" /> Resume Preview
          </h2>
          <PdfViewer url={data.resume_url} />
        </div>
      )}

      <ActionButtons onApprove={onApprove} onReject={onReject} acting={acting}
        approveLabel="✅ Approve & Create Account" rejectLabel="❌ Reject Hire" />
    </div>
  );
}

// ── Fire Detail ─────────────────────────────────────────────────────────────
function FireDetail({ data, onApprove, onReject, acting }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800">Termination Request</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Approving this will permanently deactivate the employee's account and remove them from all projects.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
          <UserMinus className="w-4 h-4 text-red-500" /> Termination Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InfoRow icon={User} label="Employee ID" value={data.target_user_id} />
          <InfoRow icon={Calendar} label="Last Working Day"
            value={data.last_working_day ? new Date(data.last_working_day).toLocaleDateString('en-US', { dateStyle: 'long' }) : 'Not specified'} />
          <InfoRow icon={FileText} label="Reason" value={data.reason || 'No reason provided'} />
        </div>
      </div>

      <ActionButtons onApprove={onApprove} onReject={onReject} acting={acting}
        approveLabel="⚠️ Approve Termination" rejectLabel="❌ Reject Request"
        approveDanger />
    </div>
  );
}

// ── Intern Detail ───────────────────────────────────────────────────────────
function InternDetail({ data, onApprove, onReject, acting }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-blue-500" /> Intern Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InfoRow icon={User} label="Full Name" value={data.name} />
          <InfoRow icon={Mail} label="Email" value={data.email} />
          <InfoRow icon={Building} label="College / Institution" value={data.college} />
          <InfoRow icon={Clock} label="Duration" value={data.duration_months ? `${data.duration_months} months` : null} />
          <InfoRow icon={Briefcase} label="Stipend" value={data.stipend} />
        </div>
      </div>

      <ActionButtons onApprove={onApprove} onReject={onReject} acting={acting}
        approveLabel="✅ Approve Internship" rejectLabel="❌ Reject" />
    </div>
  );
}

// ── Action Buttons (sticky footer) ─────────────────────────────────────────
function ActionButtons({ onApprove, onReject, acting, approveLabel, rejectLabel, approveDanger = false }: any) {
  return (
    <div className="sticky bottom-6 z-10">
      <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-xl p-4 flex gap-3">
        <button
          onClick={onReject}
          disabled={!!acting}
          className="flex-1 flex items-center justify-center gap-2 border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-50"
        >
          {acting === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
          {rejectLabel}
        </button>
        <button
          onClick={onApprove}
          disabled={!!acting}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 text-white rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-50',
            approveDanger
              ? 'bg-amber-600 hover:bg-amber-700'
              : 'bg-emerald-600 hover:bg-emerald-700'
          )}
        >
          {acting === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {approveLabel}
        </button>
      </div>
    </div>
  );
}

// ── Status Badge ────────────────────────────────────────────────────────────
const STATUS: Record<string, { cls: string; label: string }> = {
  pending:  { cls: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Pending Approval' },
  approved: { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Approved' },
  rejected: { cls: 'bg-red-100 text-red-700 border-red-200', label: 'Rejected' },
};

// ── Main Page ───────────────────────────────────────────────────────────────
export function HrApprovalPage() {
  const { type, id } = useParams<{ type: FlowType; id: string }>();
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  const { user } = useAuthStore();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<'approve' | 'reject' | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [done, setDone] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  const endpointBase: Record<FlowType, string> = {
    hire:   'hr-records/candidates',
    fire:   'hr-records/terminations',
    intern: 'hr-records/interns',
  };

  const base = type ? endpointBase[type] : '';

  useEffect(() => {
    if (!base || !id) return;
    axios.get(`${API}/${base}/${id}`, { headers: auth() })
      .then(r => setData(r.data))
      .catch(() => addToast({ type: 'error', title: 'Could not load request details' }))
      .finally(() => setLoading(false));
  }, [base, id]);

  const handleApprove = async () => {
    setActing('approve');
    try {
      await axios.post(`${API}/${base}/${id}/approve`, {}, { headers: auth() });
      addToast({ type: 'success', title: '✅ Approved!', message: 'The request has been approved successfully.' });
      setDone(true);
      setTimeout(() => navigate('/hr'), 2000);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Approval failed', message: e.response?.data?.detail });
    } finally { setActing(null); }
  };

  const handleReject = async (reason: string) => {
    setShowRejectModal(false);
    setActing('reject');
    try {
      await axios.post(`${API}/${base}/${id}/reject`, { reason }, { headers: auth() });
      addToast({ type: 'info', title: 'Rejected', message: 'The request has been rejected.' });
      setDone(true);
      setTimeout(() => navigate('/hr'), 2000);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Rejection failed', message: e.response?.data?.detail });
    } finally { setActing(null); }
  };

  const TITLES: Record<FlowType, string> = {
    hire:   '👤 Hire Approval',
    fire:   '⚠️ Termination Approval',
    intern: '🎓 Intern Approval',
  };

  const title = type ? TITLES[type] : 'HR Approval';
  const statusCfg = data?.status ? (STATUS[data.status] ?? STATUS.pending) : STATUS.pending;

  return (
    <div className="max-w-3xl mx-auto pb-24">
      {showRejectModal && (
        <RejectModal onClose={() => setShowRejectModal(false)} onConfirm={handleReject} />
      )}

      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-400 mt-0.5">Review details below and approve or reject</p>
        </div>
        {data?.status && (
          <span className={cn('text-xs px-3 py-1 rounded-full font-semibold border', statusCfg.cls)}>
            {statusCfg.label}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
      ) : !data ? (
        <div className="text-center py-24 text-gray-400">Request not found or you don't have access.</div>
      ) : done ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <CheckCircle className="w-16 h-16 text-emerald-500" />
          <p className="text-lg font-semibold text-gray-700">Done! Redirecting…</p>
        </div>
      ) : (
        <>
          {type === 'hire'   && <HireDetail   data={data} onApprove={handleApprove} onReject={() => setShowRejectModal(true)} acting={acting} />}
          {type === 'fire'   && <FireDetail   data={data} onApprove={handleApprove} onReject={() => setShowRejectModal(true)} acting={acting} />}
          {type === 'intern' && <InternDetail data={data} onApprove={handleApprove} onReject={() => setShowRejectModal(true)} acting={acting} />}

          {/* Non-admin notice */}
          {!isAdmin && data?.status === 'pending' && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
              ℹ️ Only Super Admins can approve or reject requests.
            </div>
          )}
        </>
      )}
    </div>
  );
}
