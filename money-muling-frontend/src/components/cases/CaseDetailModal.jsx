import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Modal,
  Card,
  Row,
  Col,
  Badge,
  Table,
  Button,
  Form,
  Spinner,
  Alert,
  ProgressBar,
  Dropdown,
  InputGroup,
  Pagination,
} from 'react-bootstrap';
import cytoscape from 'cytoscape';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  DollarSign,
  Network,
  Clock,
  Zap,
  CheckCircle,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  Layers,
  Users,
  Search,
  Download,
  Filter,
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  Briefcase,
  Check,
  X,
  Send,
  Sliders,
  ChevronDown,
  Info,
  Snowflake,
  ArrowLeftRight,
  Grid,
  List,
  MessageSquare,
  RefreshCw,
  Eye,
  Printer,
  RotateCcw,
  Play,
} from 'lucide-react';
import { casesAPI, adminAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import AccountDrilldownModal from './AccountDrilldownModal';

const STATUS_COLORS = {
  OPEN: { bg: 'rgba(56,139,253,0.15)', text: '#58a6ff', border: 'rgba(56,139,253,0.3)' },
  ASSIGNED: { bg: 'rgba(56,139,253,0.15)', text: '#58a6ff', border: 'rgba(56,139,253,0.3)' },
  INVESTIGATING: { bg: 'rgba(227,179,65,0.15)', text: '#e3b341', border: 'rgba(227,179,65,0.3)' },
  EVIDENCE_REVIEW: { bg: 'rgba(227,179,65,0.15)', text: '#e3b341', border: 'rgba(227,179,65,0.3)' },
  PENDING_REVIEW: { bg: 'rgba(163,113,247,0.15)', text: '#a371f7', border: 'rgba(163,113,247,0.3)' },
  REVISION_REQUIRED: { bg: 'rgba(248,81,73,0.15)', text: '#f85149', border: 'rgba(248,81,73,0.3)' },
  RESOLVED: { bg: 'rgba(63,185,80,0.15)', text: '#3fb950', border: 'rgba(63,185,80,0.3)' },
  CLOSED: { bg: 'rgba(139,148,158,0.15)', text: '#8b949e', border: 'rgba(139,148,158,0.3)' },
};

const FORWARD_STAGES = {
  SUBMITTED: ['OPEN', 'ASSIGNED'],
  OPEN: ['ASSIGNED', 'INVESTIGATING'],
  ASSIGNED: ['INVESTIGATING', 'EVIDENCE_REVIEW'],
  IN_PROGRESS: ['INVESTIGATING', 'EVIDENCE_REVIEW', 'PENDING_REVIEW'],
  INVESTIGATING: ['EVIDENCE_REVIEW', 'PENDING_REVIEW'],
  EVIDENCE_REVIEW: ['PENDING_REVIEW'],
  PENDING_REVIEW: ['APPROVED', 'CLOSED'],
  APPROVED: ['CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

const PRIORITY_COLORS = {
  CRITICAL: '#f85149',
  HIGH: '#f85149',
  MEDIUM: '#e3b341',
  LOW: '#3fb950',
};

const PIE_COLORS = ['#f85149', '#3fb950', '#d29922', '#a371f7', '#58a6ff'];

// Safe formatter for alert trigger reasons that can be strings, objects or JSON
const getReasonText = (val) => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    if (val.reason && val.details) return `${val.reason}: ${typeof val.details === 'object' ? JSON.stringify(val.details) : val.details}`;
    if (val.reason) return typeof val.reason === 'object' ? JSON.stringify(val.reason) : String(val.reason);
    if (val.details) return typeof val.details === 'object' ? JSON.stringify(val.details) : String(val.details);
    if (val.message) return String(val.message);
    if (val.description) return String(val.description);
    return JSON.stringify(val);
  }
  return String(val);
};

// Helper to determine status style for transactions and accounts
export function getEntityStatusStyle(isFraud, riskScore, isFlagged) {
  if (!isFraud && (riskScore <= 0.35 || (!isFlagged && riskScore <= 0.5))) {
    return {
      status: 'LEGIT',
      label: 'Legitimate / Safe',
      color: '#3fb950',
      bg: 'rgba(63,185,80,0.08)',
      border: 'rgba(63,185,80,0.25)',
      badgeBg: 'success',
      badgeText: 'LEGIT',
    };
  } else if (riskScore > 0.35 && riskScore < 0.65) {
    return {
      status: 'MODERATE',
      label: 'Moderate / Review',
      color: '#e3b341',
      bg: 'rgba(227,179,65,0.08)',
      border: 'rgba(227,179,65,0.25)',
      badgeBg: 'warning',
      badgeText: 'MODERATE',
    };
  } else {
    return {
      status: 'DANGER',
      label: 'Fraud / Danger',
      color: '#f85149',
      bg: 'rgba(248,81,73,0.08)',
      border: 'rgba(248,81,73,0.25)',
      badgeBg: 'danger',
      badgeText: 'FRAUD',
    };
  }
}

export default function CaseDetailModal({ show, onHide, caseId, onCaseUpdated }) {
  const [intel, setIntel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Selected account for deep drilldown popup
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  // Selected account for network graph highlighting
  const [highlightedNodeId, setHighlightedNodeId] = useState(null);

  // Pair selection for "Between Transactions" viewer
  const [betweenPair, setBetweenPair] = useState(null); // { accountA: '', accountB: '' }

  // Quick Note Modal State
  const [noteModalTarget, setNoteModalTarget] = useState(null); // { type: 'TRANSACTION' | 'ACCOUNT', id: '...' }
  const [entityNoteText, setEntityNoteText] = useState('');
  const [savingEntityNote, setSavingEntityNote] = useState(false);

  // Action states for Transactions tab
  const [txSearch, setTxSearch] = useState('');
  const [txTypologyFilter, setTxTypologyFilter] = useState('');
  const [txDecisionFilter, setTxDecisionFilter] = useState('');
  const [txStatusFilter, setTxStatusFilter] = useState('ALL'); // 'ALL' | 'LEGIT' | 'MODERATE' | 'FRAUD'
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(20);
  const [txActionLoading, setTxActionLoading] = useState({});

  // Action states for Accounts tab
  const [accSearch, setAccSearch] = useState('');
  const [accFilterStatus, setAccFilterStatus] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'MODERATE' | 'SAFE' | 'FROZEN'
  const [accSortBy, setAccSortBy] = useState('risk_desc'); // 'risk_desc' | 'risk_asc' | 'inflow_desc' | 'outflow_desc' | 'degree_desc'
  const [accViewMode, setAccViewMode] = useState('grid'); // 'grid' | 'table'
  const [accActionLoading, setAccActionLoading] = useState({});

  // Action states for Frauds & Alerts tab
  const [alertSearch, setAlertSearch] = useState('');
  const [alertStatusFilter, setAlertStatusFilter] = useState('NEW'); // 'NEW' | 'CONFIRMED' | 'DISMISSED' | 'ESCALATED' | 'ALL'
  const [alertSortBy, setAlertSortBy] = useState('risk_desc');
  const [alertActionLoading, setAlertActionLoading] = useState({});
  const [alertConfirmTarget, setAlertConfirmTarget] = useState(null); // { alertId, action, patternName }
  const [alertConfirmNotes, setAlertConfirmNotes] = useState('');

  // Case Note & Formal Decision states
  const [caseNoteContent, setCaseNoteContent] = useState('');
  const [addingCaseNote, setAddingCaseNote] = useState(false);
  const [decisionState, setDecisionState] = useState({
    decision: 'SUSPICIOUS_ACTIVITY',
    reason: '',
    riskScore: 0.85,
  });
  const [savingDecision, setSavingDecision] = useState(false);
  const [hypothesisForm, setHypothesisForm] = useState({ title: '', description: '' });

  // Cytoscape ref
  const cyContainerRef = useRef(null);
  const cyCaseRef = useRef(null);

  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isClient = user?.role === 'CLIENT_USER';
  const isAssigned = intel?.case?.assigned_investigator_id === user?.id;

  // Assignment Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [staffUsers, setStaffUsers] = useState([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Transition & Self-Approval Modal State
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [pendingTargetStatus, setPendingTargetStatus] = useState('');
  const [transitionNotes, setTransitionNotes] = useState('');
  const [selfApprovalException, setSelfApprovalException] = useState(false);
  const [selfApprovalReason, setSelfApprovalReason] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Report Release State
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState('');
  const [releaseOrgId, setReleaseOrgId] = useState('');
  const [isReleasing, setIsReleasing] = useState(false);

  useEffect(() => {
    if (show && caseId) {
      loadIntelligence();
    } else {
      setIntel(null);
      setError(null);
      setSelectedAccountId(null);
      setHighlightedNodeId(null);
      setBetweenPair(null);
      if (cyCaseRef.current) {
        cyCaseRef.current.destroy();
        cyCaseRef.current = null;
      }
    }
  }, [show, caseId]);

  const loadIntelligence = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await casesAPI.getIntelligence(caseId);
      setIntel(data);
      if (data.case?.decision) {
        setDecisionState({
          decision: data.case.decision,
          reason: data.case.decision_reason || '',
          riskScore: data.case.investigation_risk_score || 0.85,
        });
      }
    } catch (err) {
      console.error('Failed to load case intelligence:', err);
      setError(err.response?.data?.detail || 'Failed to fetch comprehensive case intelligence.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTransition = (targetStatus) => {
    setPendingTargetStatus(targetStatus);
    setTransitionNotes('');
    setSelfApprovalException(false);
    setSelfApprovalReason('');
    setShowTransitionModal(true);
  };

  const handleExecuteTransition = async (e) => {
    if (e) e.preventDefault();
    try {
      setIsTransitioning(true);
      await casesAPI.transitionStatus(
        caseId,
        pendingTargetStatus,
        transitionNotes,
        selfApprovalException,
        selfApprovalReason
      );
      setShowTransitionModal(false);
      await loadIntelligence();
      onCaseUpdated?.();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to transition case status');
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleOpenAssignModal = async () => {
    try {
      const usersData = await adminAPI.getUsers();
      const eligible = (usersData.users || usersData.items || usersData || []).filter(
        (u) => u.role === 'INVESTIGATOR' || u.role === 'TRACE_LAB_ANALYST' || u.role === 'ADMIN'
      );
      setStaffUsers(eligible);
      setSelectedAssigneeId(intel?.case?.assigned_investigator_id || (eligible[0]?.id || ''));
      setAssignNotes('');
      setShowAssignModal(true);
    } catch (err) {
      alert('Failed to load staff list');
    }
  };

  const handleExecuteAssign = async (e) => {
    e.preventDefault();
    if (!selectedAssigneeId) return;
    try {
      setIsAssigning(true);
      await casesAPI.assign(caseId, Number(selectedAssigneeId), assignNotes);
      setShowAssignModal(false);
      await loadIntelligence();
      onCaseUpdated?.();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to assign case.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleReleaseReport = async (e) => {
    if (e) e.preventDefault();
    try {
      setIsReleasing(true);
      await casesAPI.releaseReport(
        caseId,
        null, // Backend automatically routes to the requesting organization
        releaseNotes
      );
      setShowReleaseModal(false);
      await loadIntelligence();
      onCaseUpdated?.();
      alert('Official investigation report released successfully to the requesting client.');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to release report.');
    } finally {
      setIsReleasing(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    handleOpenTransition(newStatus);
  };

  // -------------------------------------------------------------
  // Alert Decision Handling (Immediate Triage Update)
  // -------------------------------------------------------------
  const handleAlertDecision = async (alertId, action, notes) => {
    try {
      setAlertActionLoading((prev) => ({ ...prev, [alertId]: true }));
      const newStatus = action === 'CONFIRM_FRAUD' ? 'TRIAGED' : action === 'DISMISS' ? 'DISMISSED' : 'ESCALATED';

      // Optimistically update local state so alert immediately vanishes from pending triage queue
      setIntel((prev) => {
        if (!prev || !prev.alerts) return prev;
        return {
          ...prev,
          alerts: prev.alerts.map((al) => (al.id === alertId ? { ...al, status: newStatus } : al)),
        };
      });

      await casesAPI.decideAlert(caseId, alertId, action, notes);
      setAlertConfirmTarget(null);
      setAlertConfirmNotes('');
      await loadIntelligence();
      onCaseUpdated?.();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to record alert decision');
      await loadIntelligence();
    } finally {
      setAlertActionLoading((prev) => ({ ...prev, [alertId]: false }));
    }
  };

  // -------------------------------------------------------------
  // Transaction Override (Single Toggle: Legit <-> Fraud)
  // -------------------------------------------------------------
  const handleTxToggle = async (txId, isCurrentlyFraudOrFlagged) => {
    const nextAction = isCurrentlyFraudOrFlagged ? 'MARK_LEGIT' : 'MARK_FRAUD';
    try {
      setTxActionLoading((prev) => ({ ...prev, [txId]: true }));
      await casesAPI.overrideTransaction(caseId, txId, nextAction, `Operator toggled to ${nextAction}`);
      await loadIntelligence();
      onCaseUpdated?.();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update transaction status');
    } finally {
      setTxActionLoading((prev) => ({ ...prev, [txId]: false }));
    }
  };

  // -------------------------------------------------------------
  // Account Override (Single Toggle: Mark Entire Account Legit <-> Fraud)
  // -------------------------------------------------------------
  const handleAccountToggle = async (accountId, isCurrentlyFraudOrFlagged) => {
    const nextAction = isCurrentlyFraudOrFlagged ? 'MARK_LEGIT' : 'MARK_FRAUD';
    try {
      setAccActionLoading((prev) => ({ ...prev, [accountId]: true }));
      await casesAPI.overrideAccount(caseId, accountId, nextAction, `Operator bulk toggled account to ${nextAction}`);
      await loadIntelligence();
      onCaseUpdated?.();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update account status');
    } finally {
      setAccActionLoading((prev) => ({ ...prev, [accountId]: false }));
    }
  };

  // -------------------------------------------------------------
  // Freeze / Unfreeze Account Toggle
  // -------------------------------------------------------------
  const handleFreezeToggle = async (accountId, isCurrentlyFrozen) => {
    try {
      setAccActionLoading((prev) => ({ ...prev, [accountId]: true }));
      await casesAPI.freezeAccount(
        caseId,
        accountId,
        !isCurrentlyFrozen,
        isCurrentlyFrozen ? 'Unfrozen by investigator' : 'Frozen due to money muling risk'
      );
      await loadIntelligence();
      onCaseUpdated?.();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update freeze status');
    } finally {
      setAccActionLoading((prev) => ({ ...prev, [accountId]: false }));
    }
  };

  // -------------------------------------------------------------
  // Entity Notes (Transactions & Accounts)
  // -------------------------------------------------------------
  const handleOpenNoteModal = (type, id) => {
    setNoteModalTarget({ type, id });
    setEntityNoteText('');
  };

  const handleSaveEntityNote = async (e) => {
    e.preventDefault();
    if (!entityNoteText.trim() || !noteModalTarget) return;
    try {
      setSavingEntityNote(true);
      await casesAPI.addEntityNote(caseId, noteModalTarget.type, noteModalTarget.id, entityNoteText.trim());
      setNoteModalTarget(null);
      setEntityNoteText('');
      await loadIntelligence();
      onCaseUpdated?.();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save entity note');
    } finally {
      setSavingEntityNote(false);
    }
  };

  // -------------------------------------------------------------
  // General Case Note
  // -------------------------------------------------------------
  const handleAddCaseNote = async (e) => {
    e.preventDefault();
    if (!caseNoteContent.trim()) return;
    try {
      setAddingCaseNote(true);
      await casesAPI.addNote(caseId, caseNoteContent.trim());
      setCaseNoteContent('');
      await loadIntelligence();
      onCaseUpdated?.();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add note');
    } finally {
      setAddingCaseNote(false);
    }
  };

  const handleRecordDecision = async (e) => {
    e.preventDefault();
    try {
      setSavingDecision(true);
      await casesAPI.recordDecision(caseId, {
        decision: decisionState.decision,
        reason: decisionState.reason,
        investigationRiskScore: decisionState.riskScore,
      });
      await loadIntelligence();
      onCaseUpdated?.();
      alert('Investigation decision recorded successfully.');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to record decision');
    } finally {
      setSavingDecision(false);
    }
  };

  const handleAddHypothesis = async (e) => {
    e.preventDefault();
    if (!hypothesisForm.title.trim()) return;
    try {
      await casesAPI.createHypothesis(caseId, hypothesisForm);
      setHypothesisForm({ title: '', description: '' });
      await loadIntelligence();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create hypothesis');
    }
  };

  const handleExportReport = async () => {
    try {
      const draft = await casesAPI.getReportDraft(caseId);
      const element = document.createElement('a');
      const file = new Blob([draft.markdown], { type: 'text/markdown' });
      element.href = URL.createObjectURL(file);
      element.download = `Investigation_Report_Case_${caseId}.md`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (err) {
      alert('Failed to generate report draft download.');
    }
  };

  const handleExportTransactionsCSV = () => {
    if (!intel?.transactions?.length) return;
    const headers = ['transaction_id', 'timestamp', 'sender_account', 'receiver_account', 'amount', 'channel', 'ground_truth', 'typology', 'decision', 'risk_score'];
    const rows = intel.transactions.map((t) => [
      t.transaction_id,
      t.timestamp,
      t.sender_account,
      t.receiver_account,
      t.amount,
      t.channel,
      t.synthetic_ground_truth,
      t.scenario_name || t.scenario_id,
      t.final_decision,
      t.risk_score,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `case_${caseId}_transactions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Map of all accounts by ID for fast counterparty status lookups
  const accountsMap = useMemo(() => {
    const map = {};
    (intel?.accounts || []).forEach((acc) => {
      map[acc.account_id] = acc;
    });
    return map;
  }, [intel?.accounts]);

  // -------------------------------------------------------------
  // Filtered & Paginated Transactions
  // -------------------------------------------------------------
  const filteredTransactions = useMemo(() => {
    return (intel?.transactions || []).filter((t) => {
      const q = txSearch.toLowerCase();
      const matchesSearch =
        !txSearch ||
        t.transaction_id?.toLowerCase().includes(q) ||
        t.sender_account?.toLowerCase().includes(q) ||
        t.receiver_account?.toLowerCase().includes(q) ||
        t.scenario_name?.toLowerCase().includes(q);
      
      const matchesTypology = !txTypologyFilter || t.scenario_id === txTypologyFilter;
      const matchesDecision = !txDecisionFilter || t.final_decision === txDecisionFilter;

      const isFraud = t.synthetic_ground_truth === 'fraudulent' || t.final_decision in { FLAG: 1, HOLD: 1, REJECT: 1 };
      const style = getEntityStatusStyle(isFraud, t.risk_score || 0.5, isFraud);
      const matchesStatus =
        txStatusFilter === 'ALL' ||
        (txStatusFilter === 'LEGIT' && style.status === 'LEGIT') ||
        (txStatusFilter === 'MODERATE' && style.status === 'MODERATE') ||
        (txStatusFilter === 'FRAUD' && style.status === 'DANGER');

      return matchesSearch && matchesTypology && matchesDecision && matchesStatus;
    });
  }, [intel?.transactions, txSearch, txTypologyFilter, txDecisionFilter, txStatusFilter]);

  const totalTxPages = Math.ceil(filteredTransactions.length / txPageSize) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (txPage - 1) * txPageSize;
    return filteredTransactions.slice(start, start + txPageSize);
  }, [filteredTransactions, txPage, txPageSize]);

  // -------------------------------------------------------------
  // Filtered & Sorted Accounts
  // -------------------------------------------------------------
  const processedAccounts = useMemo(() => {
    let list = [...(intel?.accounts || [])];

    // Search filter
    if (accSearch) {
      const q = accSearch.toLowerCase();
      list = list.filter(
        (a) =>
          a.account_id?.toLowerCase().includes(q) ||
          a.role?.toLowerCase().includes(q) ||
          a.counterparties?.some((cp) => cp?.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (accFilterStatus !== 'ALL') {
      if (accFilterStatus === 'FROZEN') {
        list = list.filter((a) => a.is_frozen);
      } else if (accFilterStatus === 'SAFE') {
        list = list.filter((a) => a.risk_score <= 0.35 && !a.is_flagged);
      } else if (accFilterStatus === 'MODERATE') {
        list = list.filter((a) => a.risk_score > 0.35 && a.risk_score < 0.65);
      } else if (accFilterStatus === 'CRITICAL') {
        list = list.filter((a) => a.risk_score >= 0.65 || a.is_flagged);
      }
    }

    // Sorting
    list.sort((a, b) => {
      if (accSortBy === 'risk_desc') return b.risk_score - a.risk_score;
      if (accSortBy === 'risk_asc') return a.risk_score - b.risk_score;
      if (accSortBy === 'inflow_desc') return b.inflow_total - a.inflow_total;
      if (accSortBy === 'outflow_desc') return b.outflow_total - a.outflow_total;
      if (accSortBy === 'degree_desc') return (b.degree || 0) - (a.degree || 0);
      return 0;
    });

    return list;
  }, [intel?.accounts, accSearch, accFilterStatus, accSortBy]);

  // -------------------------------------------------------------
  // Filtered & Sorted Alerts
  // -------------------------------------------------------------
  const processedAlerts = useMemo(() => {
    let list = [...(intel?.alerts || [])];

    if (alertSearch) {
      const q = alertSearch.toLowerCase();
      list = list.filter(
        (al) =>
          al.pattern_name?.toLowerCase().includes(q) ||
          getReasonText(al.trigger_reason).toLowerCase().includes(q) ||
          getReasonText(al.detection_reason).toLowerCase().includes(q) ||
          String(al.id).includes(q) ||
          al.related_accounts?.some((acc) => String(acc).toLowerCase().includes(q))
      );
    }

    if (alertStatusFilter !== 'ALL') {
      if (alertStatusFilter === 'NEW') list = list.filter((al) => al.status === 'NEW');
      else if (alertStatusFilter === 'CONFIRMED') list = list.filter((al) => al.status === 'TRIAGED' || al.status === 'CONFIRMED_FRAUD');
      else if (alertStatusFilter === 'DISMISSED') list = list.filter((al) => al.status === 'DISMISSED');
      else if (alertStatusFilter === 'ESCALATED') list = list.filter((al) => al.status === 'ESCALATED');
    }

    list.sort((a, b) => {
      if (alertSortBy === 'risk_desc') return (b.risk_score || 0.8) - (a.risk_score || 0.8);
      if (alertSortBy === 'risk_asc') return (a.risk_score || 0.8) - (b.risk_score || 0.8);
      if (alertSortBy === 'newest') return (b.id || 0) - (a.id || 0);
      if (alertSortBy === 'oldest') return (a.id || 0) - (b.id || 0);
      return 0;
    });

    return list;
  }, [intel?.alerts, alertSearch, alertStatusFilter, alertSortBy]);

  // -------------------------------------------------------------
  // "Between Accounts" Transactions Filter
  // -------------------------------------------------------------
  const betweenTransactions = useMemo(() => {
    if (!betweenPair?.accountA || !betweenPair?.accountB) return [];
    const a = betweenPair.accountA;
    const b = betweenPair.accountB;
    return (intel?.transactions || []).filter(
      (t) =>
        (t.sender_account === a && t.receiver_account === b) ||
        (t.sender_account === b && t.receiver_account === a)
    );
  }, [intel?.transactions, betweenPair]);

  // -------------------------------------------------------------
  // Cytoscape Graph Rendering
  // -------------------------------------------------------------
  useEffect(() => {
    if (activeTab === 'graph' && intel && cyContainerRef.current) {
      if (cyCaseRef.current) {
        cyCaseRef.current.destroy();
      }

      const rawNodes = intel.graph?.nodes || [];
      const rawEdges = intel.graph?.edges || [];

      // Augment nodes with highlighted status
      const formattedNodes = rawNodes.map((n) => {
        const isHighlight = highlightedNodeId && n.data.id === highlightedNodeId;
        return {
          ...n,
          data: {
            ...n.data,
            is_highlighted: isHighlight ? 1 : 0,
          },
        };
      });

      cyCaseRef.current = cytoscape({
        container: cyContainerRef.current,
        elements: [...formattedNodes, ...rawEdges],
        style: [
          {
            selector: 'node',
            style: {
              label: 'data(label)',
              color: '#ffffff',
              'font-size': '10px',
              'text-valign': 'bottom',
              'text-margin-y': 4,
              width: 38,
              height: 38,
              'background-color': '#1f6feb',
              'border-width': 2,
              'border-color': '#ffffff',
            },
          },
          {
            selector: 'node[risk_score >= 0.65]',
            style: {
              'background-color': '#f85149',
              'border-color': '#ff7b72',
              width: 44,
              height: 44,
            },
          },
          {
            selector: 'node[risk_score >= 0.35][risk_score < 0.65]',
            style: {
              'background-color': '#d29922',
              'border-color': '#e3b341',
              width: 40,
              height: 40,
            },
          },
          {
            selector: 'node[risk_score < 0.35]',
            style: {
              'background-color': '#238636',
              'border-color': '#3fb950',
              width: 38,
              height: 38,
            },
          },
          {
            selector: 'node[is_seed]',
            style: {
              'border-width': 3.5,
              'border-color': '#f1e05a',
            },
          },
          {
            selector: 'node[is_highlighted = 1]',
            style: {
              'border-width': 5,
              'border-color': '#00f2fe',
              'background-color': '#388bfd',
              width: 52,
              height: 52,
              'font-weight': 'bold',
              'font-size': '12px',
            },
          },
          {
            selector: 'edge',
            style: {
              width: 2,
              'line-color': '#484f58',
              'target-arrow-color': '#8b949e',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              'arrow-scale': 0.8,
            },
          },
          {
            selector: 'edge[is_fraud]',
            style: {
              width: 2.5,
              'line-color': '#f85149',
              'target-arrow-color': '#f85149',
            },
          },
          {
            selector: 'edge[!is_fraud]',
            style: {
              width: 2,
              'line-color': '#238636',
              'target-arrow-color': '#3fb950',
            },
          },
        ],
        layout: {
          name: 'cose',
          padding: 30,
          animate: false,
        },
      });

      cyCaseRef.current.on('tap', 'node', (evt) => {
        const node = evt.target;
        const accId = node.id();
        setSelectedAccountId(accId);
        setHighlightedNodeId(accId);
      });
    }
  }, [activeTab, intel, highlightedNodeId]);

  const caseObj = intel?.case;
  const statusStyle = STATUS_COLORS[caseObj?.status || 'OPEN'] || STATUS_COLORS.OPEN;
  const prioColor = PRIORITY_COLORS[caseObj?.priority || 'MEDIUM'] || '#e3b341';

  return (
    <>
      <Modal
        show={show}
        onHide={onHide}
        fullscreen
        contentClassName="bg-black text-light border-0"
        className="case-detail-modal"
      >
        {/* Top Header */}
        <Modal.Header closeButton closeVariant="white" className="border-secondary border-opacity-25 bg-black py-3 px-4">
          <div className="d-flex flex-wrap align-items-center justify-content-between w-100 pe-3 gap-3">
            {/* Title & Case Meta */}
            <div className="d-flex align-items-center gap-3">
              <div className="p-2.5 rounded-3 bg-secondary bg-opacity-20 text-white border border-secondary border-opacity-25">
                <Briefcase size={22} className="text-warning" />
              </div>
              <div>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <h5 className="mb-0 fw-bold text-white">
                    {caseObj?.title || `Case #${caseId}`}
                  </h5>
                  <Badge bg="dark" className="border border-secondary font-monospace" style={{ fontSize: '11px' }}>
                    CASE #{caseId}
                  </Badge>

                  {/* Status Dropdown / Badge (One-Way) */}
                  {isAdmin && (FORWARD_STAGES[caseObj?.status || 'OPEN'] || []).length > 0 ? (
                    <Dropdown>
                      <Dropdown.Toggle
                        size="sm"
                        style={{
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.text,
                          borderColor: statusStyle.border,
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                        className="d-inline-flex align-items-center gap-1 border"
                      >
                        {(caseObj?.status || 'OPEN').replace(/_/g, ' ')}
                      </Dropdown.Toggle>
                      <Dropdown.Menu variant="dark" style={{ background: '#161b22', borderColor: '#30363d' }}>
                        <div className="px-3 py-1 text-muted" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>
                          Advance Lifecycle (One-Way)
                        </div>
                        {(FORWARD_STAGES[caseObj?.status || 'OPEN'] || []).map((st) => (
                          <Dropdown.Item key={st} onClick={() => handleStatusChange(st)} className="small text-light">
                            → Advance to {st.replace(/_/g, ' ')}
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown>
                  ) : (
                    <Badge
                      style={{
                        backgroundColor: statusStyle.bg,
                        color: statusStyle.text,
                        border: `1px solid ${statusStyle.border}`,
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {(caseObj?.status || 'OPEN').replace(/_/g, ' ')}
                    </Badge>
                  )}

                  <Badge
                    style={{
                      backgroundColor: `${prioColor}22`,
                      color: prioColor,
                      border: `1px solid ${prioColor}66`,
                      fontSize: '11px',
                    }}
                  >
                    {caseObj?.priority || 'MEDIUM'} PRIORITY
                  </Badge>

                  <Badge bg="dark" className="border border-secondary text-light font-monospace" style={{ fontSize: '11px' }}>
                    {(caseObj?.case_origin || 'MANUAL_INTERNAL').replace(/_/g, ' ')}
                  </Badge>

                  {intel?.simulation && (
                    <Badge bg="dark" className="border border-info border-opacity-50 text-info" style={{ fontSize: '11px' }}>
                      LiveShield #{intel.simulation.id}
                    </Badge>
                  )}
                </div>

                <div className="text-muted small mt-1 d-flex align-items-center gap-3 flex-wrap">
                  <span>Investigator: <strong className="text-white">{caseObj?.assigned_investigator_name || caseObj?.assigned_investigator?.username || 'Admin / Unassigned'}</strong></span>
                  <span>Created: <strong className="text-white">{caseObj?.created_at ? new Date(caseObj.created_at).toLocaleDateString() : '—'}</strong></span>
                  <span>TraceLab Score: <strong className="text-warning">{caseObj?.tracelab_risk_score ? `${(caseObj.tracelab_risk_score * 100).toFixed(0)}%` : '—'}</strong></span>
                  <span>Investigated Risk: <strong className="text-danger">{caseObj?.investigation_risk_score ? `${(caseObj.investigation_risk_score * 100).toFixed(0)}%` : 'Pending'}</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <Button
                variant={caseObj?.status === 'CLOSED' ? 'success' : 'outline-primary'}
                size="sm"
                onClick={() => window.open(`/cases/${caseId}/pdf`, '_blank')}
                className="d-flex align-items-center gap-1.5 fw-bold"
                title="Open and download official AML Case Closure Investigation PDF"
              >
                <Printer size={13} /> {caseObj?.status === 'CLOSED' ? '📄 Download Case PDF' : '📄 Official PDF Report'}
              </Button>
              <Button variant="outline-light" size="sm" onClick={loadIntelligence} title="Reload case intelligence">
                <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
              </Button>
              <Button variant="outline-info" size="sm" onClick={handleExportReport} className="d-flex align-items-center gap-1">
                <Download size={13} /> Export .MD
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={handleExportTransactionsCSV} className="d-flex align-items-center gap-1">
                <Download size={13} /> Export .CSV
              </Button>
            </div>
          </div>
        </Modal.Header>

        {/* Investigator 5-Step SOP Stepper */}
        <div className="px-4 py-2.5 bg-black border-bottom border-secondary border-opacity-25">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <span className="small text-white fw-bold text-uppercase d-flex align-items-center gap-1.5" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
              <Zap size={13} className="text-warning" /> Investigator Standard Workflow Guide
            </span>
            <span className="text-muted small" style={{ fontSize: '11px' }}>
              Current Stage: <strong className="text-info">{(caseObj?.status || 'OPEN').replace(/_/g, ' ')}</strong> · Forward-Only State Machine
            </span>
          </div>
          <div className="row g-2">
            {[
              { num: 1, title: 'Step 1: Signal Triage', desc: 'Alerts & Initial Risk', tab: 'frauds', match: ['SUBMITTED', 'OPEN'] },
              { num: 2, title: 'Step 2: Entity & Graph Review', desc: 'Accounts, Overrides & Cyto Graph', tab: 'accounts', match: ['ASSIGNED', 'INVESTIGATING', 'IN_PROGRESS'] },
              { num: 3, title: 'Step 3: Typology & Matrix', desc: 'ML Evaluation & Ring Detection', tab: 'evaluation', match: ['EVIDENCE_REVIEW'] },
              { num: 4, title: 'Step 4: SAR Decision & File', desc: 'Hypotheses, Narrative & Risk', tab: 'tracking', match: ['PENDING_REVIEW'] },
              { num: 5, title: 'Step 5: Admin Audit & Release', desc: 'Quality Signoff & PDF Release', tab: 'dashboard', match: ['APPROVED', 'RESOLVED', 'CLOSED'] },
            ].map((step) => {
              const isCurrent = step.match.includes(caseObj?.status || 'OPEN');
              return (
                <div key={step.num} className="col">
                  <div
                    onClick={() => setActiveTab(step.tab)}
                    style={{
                      background: isCurrent ? 'rgba(56,139,253,0.15)' : '#161b22',
                      border: `1px solid ${isCurrent ? '#388bfd' : '#30363d'}`,
                      borderRadius: 6,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div className="d-flex align-items-center gap-1.5 mb-1">
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: isCurrent ? '#1f6feb' : '#21262d',
                          color: isCurrent ? '#ffffff' : '#8b949e',
                          fontSize: '10px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {step.num}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: isCurrent ? '#58a6ff' : '#f0f6fc' }}>
                        {step.title}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#8b949e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {step.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="px-4 pt-2 bg-dark bg-opacity-30 border-bottom border-secondary border-opacity-25">
          <div className="d-flex gap-1 flex-wrap overflow-auto">
            {[
              { key: 'dashboard', label: 'Dashboard & Analytics', icon: Activity },
              { key: 'transactions', label: `Transactions (${intel?.transactions?.length || 0})`, icon: DollarSign },
              { key: 'accounts', label: `Account Forensics Hub (${intel?.accounts?.length || 0})`, icon: Users },
              { key: 'frauds', label: `Frauds & Alerts (${intel?.alerts?.filter((a) => a.status === 'NEW').length || 0})`, icon: ShieldAlert },
              { key: 'evaluation', label: 'Model Evaluation & Matrix', icon: Zap },
              { key: 'graph', label: 'Network Graph Explorer', icon: Network },
              { key: 'timeline', label: 'Activity Timeline & Notes', icon: Clock },
              { key: 'riskmap', label: 'Risk Map & Typologies', icon: Layers },
              { key: 'tracking', label: 'Case File & Decision', icon: CheckCircle },
            ].map((tab) => {
              const isAct = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`btn btn-sm d-flex align-items-center gap-1.5 py-2 px-3 border-0 rounded-bottom-0 rounded-top-2 fw-semibold ${
                    isAct
                      ? 'bg-black text-white border-top border-start border-end border-secondary border-opacity-50'
                      : 'text-secondary bg-transparent'
                  }`}
                  style={{ fontSize: '13px' }}
                >
                  <Icon size={14} className={isAct ? 'text-primary' : ''} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body with Multi-tab Views */}
        <Modal.Body className="p-4" style={{ minHeight: '500px', overflowY: 'auto', background: '#090b10' }}>
          {loading && !intel ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" size="sm" className="mb-2" />
              <div className="text-muted small">Loading complete case intelligence, forensics & model matrix...</div>
            </div>
          ) : error ? (
            <Alert variant="danger" className="border-0 bg-danger bg-opacity-15 text-danger">
              <AlertTriangle size={16} className="me-2" />
              {error}
            </Alert>
          ) : intel ? (
            <>
              {/* Synthetic Simulation Persistent Watermark Alert */}
              {(caseObj?.is_synthetic || caseObj?.case_origin === 'LIVESHIELD_SIMULATION') && (
                <Alert
                  variant="danger"
                  className="d-flex align-items-center justify-content-between mb-3 py-2.5 px-3 bg-danger bg-opacity-10 border-danger border-opacity-40 text-danger small fw-bold"
                >
                  <div className="d-flex align-items-center gap-2">
                    <ShieldAlert size={18} />
                    <span>🧪 TEST / SYNTHETIC SIMULATION — NOT FOR REGULATORY FILING (Origin: LiveShield Engine)</span>
                  </div>
                  <Badge bg="danger" className="text-uppercase">Synthetic Data</Badge>
                </Alert>
              )}

              {/* Report Released Active Banner */}
              {caseObj?.active_release && (
                <Alert
                  variant="info"
                  className="d-flex align-items-center justify-content-between mb-3 py-2.5 px-3 bg-info bg-opacity-10 border-info border-opacity-40 text-info small"
                >
                  <div className="d-flex align-items-center gap-2">
                    <CheckCircle size={18} />
                    <span>
                      <strong>Official Client Report Released:</strong> Version v{caseObj.active_release.version_number} ({caseObj.active_release.report_type}) released on {new Date(caseObj.active_release.released_at).toLocaleDateString()} to Recipient Organization #{caseObj.active_release.recipient_organization_id}.
                    </span>
                  </div>
                  <Badge bg="info" text="dark" className="fw-bold">v{caseObj.active_release.version_number} Active</Badge>
                </Alert>
              )}

              {/* Closed Case Banner with Direct PDF Download */}
              {(caseObj?.status === 'CLOSED' || caseObj?.status === 'RESOLVED') && (
                <Alert
                  variant="success"
                  className="d-flex flex-wrap justify-content-between align-items-center mb-3 py-2.5 px-3 bg-success bg-opacity-10 border-success border-opacity-30 text-success gap-2"
                >
                  <div className="d-flex align-items-center gap-2">
                    <CheckCircle size={18} />
                    <div>
                      <strong>Case File Closed & Archived.</strong> All forensic findings, graph typologies, and regulatory determinations are finalized.
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="success"
                    className="d-flex align-items-center gap-1.5 fw-bold px-3"
                    onClick={() => window.open(`/cases/${caseId}/pdf`, '_blank')}
                  >
                    <Printer size={13} /> Download Official PDF Report
                  </Button>
                </Alert>
              )}

              {/* Investigation Lifecycle Action Bar */}
              <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-4 p-2.5 rounded-3 bg-dark border border-secondary border-opacity-25">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span className="text-muted small fw-bold me-1">Investigation Lifecycle:</span>

                  {/* Admin Assignment Action */}
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={handleOpenAssignModal}
                      className="d-flex align-items-center gap-1"
                    >
                      <Users size={13} /> {caseObj?.assigned_investigator_id ? 'Reassign' : 'Assign Investigator'}
                    </Button>
                  )}

                  {/* Transitions */}
                  {caseObj?.status === 'SUBMITTED' && isAdmin && (
                    <Button size="sm" variant="outline-success" onClick={() => handleOpenTransition('OPEN')}>
                      <Play size={13} /> Triage & Open
                    </Button>
                  )}

                  {(caseObj?.status === 'OPEN' || caseObj?.status === 'ASSIGNED') && (isAdmin || isAssigned) && (
                    <Button size="sm" variant="outline-warning" onClick={() => handleOpenTransition('INVESTIGATING')}>
                      <Activity size={13} /> Start Investigation
                    </Button>
                  )}

                  {(caseObj?.status === 'INVESTIGATING' || caseObj?.status === 'IN_PROGRESS' || caseObj?.status === 'EVIDENCE_REVIEW') && (isAdmin || isAssigned) && (
                    <Button size="sm" variant="outline-info" onClick={() => handleOpenTransition('PENDING_REVIEW')}>
                      <Send size={13} /> Submit for Closure Review
                    </Button>
                  )}

                  {caseObj?.status === 'PENDING_REVIEW' && isAdmin && (
                    <>
                      <Button size="sm" variant="success" onClick={() => handleOpenTransition('APPROVED')}>
                        <CheckCircle size={13} /> Approve Case
                      </Button>
                      <Button size="sm" variant="outline-danger" onClick={() => handleOpenTransition('RETURNED_FOR_REVISION')}>
                        <RotateCcw size={13} /> Return for Revision
                      </Button>
                      <Button size="sm" variant="primary" onClick={() => handleOpenTransition('CLOSED')}>
                        <Briefcase size={13} /> Approve & Close Case
                      </Button>
                    </>
                  )}

                  {caseObj?.status === 'RETURNED_FOR_REVISION' && (isAdmin || isAssigned) && (
                    <Button size="sm" variant="outline-warning" onClick={() => handleOpenTransition('INVESTIGATING')}>
                      <RotateCcw size={13} /> Resume Investigation
                    </Button>
                  )}

                  {caseObj?.status === 'APPROVED' && isAdmin && (
                    <>
                      <Button size="sm" variant="primary" onClick={() => handleOpenTransition('CLOSED')}>
                        <Briefcase size={13} /> Close Case
                      </Button>
                      <Button size="sm" variant="success" onClick={() => setShowReleaseModal(true)}>
                        <Send size={13} /> Release Official Report
                      </Button>
                    </>
                  )}

                  {caseObj?.status === 'CLOSED' && isAdmin && (
                    <>
                      <Button size="sm" variant="outline-light" onClick={() => handleOpenTransition('REOPENED')}>
                        <RotateCcw size={13} /> Reopen Case
                      </Button>
                      <Button size="sm" variant="outline-success" onClick={() => setShowReleaseModal(true)}>
                        <Send size={13} /> {caseObj?.active_release ? 'Re-release Report' : 'Release Report to Client'}
                      </Button>
                    </>
                  )}
                </div>

                {caseObj?.assigned_investigator_name && (
                  <div className="text-muted small">
                    Assigned to: <span className="text-info fw-semibold">{caseObj.assigned_investigator_name}</span>
                  </div>
                )}
              </div>
              {/* ============================================================ */}
              {/* TAB 1: EXECUTIVE DASHBOARD */}
              {/* ============================================================ */}
              {activeTab === 'dashboard' && (
                <div>
                  {/* Top KPI Cards */}
                  <Row className="g-3 mb-4">
                    <Col md={3} sm={6}>
                      <Card className="bg-dark border-secondary border-opacity-25 h-100">
                        <Card.Body className="p-3">
                          <div className="text-muted small d-flex align-items-center gap-1">
                            <DollarSign size={13} className="text-danger" /> Flagged Illicit Flow
                          </div>
                          <h4 className="text-danger font-monospace fw-bold mt-1 mb-0">
                            ${(intel.metrics?.total_volume_flagged || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </h4>
                          <div className="text-muted small mt-1">{intel.metrics?.confusion_matrix?.tp || 0} illicit transactions flagged</div>
                        </Card.Body>
                      </Card>
                    </Col>

                    <Col md={3} sm={6}>
                      <Card className="bg-dark border-secondary border-opacity-25 h-100">
                        <Card.Body className="p-3">
                          <div className="text-muted small d-flex align-items-center gap-1">
                            <Users size={13} className="text-warning" /> Entities Under Scope
                          </div>
                          <h4 className="text-white font-monospace fw-bold mt-1 mb-0">
                            {intel.accounts?.length || 0} Accounts
                          </h4>
                          <div className="text-muted small mt-1">{intel.accounts?.filter(a => a.is_flagged).length || 0} suspicious / mule nodes</div>
                        </Card.Body>
                      </Card>
                    </Col>

                    <Col md={3} sm={6}>
                      <Card className="bg-dark border-secondary border-opacity-25 h-100">
                        <Card.Body className="p-3">
                          <div className="text-muted small d-flex align-items-center gap-1">
                            <ShieldAlert size={13} className="text-primary" /> Active Alerts & Motifs
                          </div>
                          <h4 className="text-white font-monospace fw-bold mt-1 mb-0">
                            {intel.alerts?.length || 0} Alerts
                          </h4>
                          <div className="text-muted small mt-1">{intel.alerts?.filter(a => a.status === 'NEW').length || 0} pending investigator triage</div>
                        </Card.Body>
                      </Card>
                    </Col>

                    <Col md={3} sm={6}>
                      <Card className="bg-dark border-secondary border-opacity-25 h-100">
                        <Card.Body className="p-3">
                          <div className="text-muted small d-flex align-items-center gap-1">
                            <Zap size={13} className="text-success" /> Model Precision & F1
                          </div>
                          <h4 className="text-success font-monospace fw-bold mt-1 mb-0">
                            {((intel.metrics?.f1_score || 0.95) * 100).toFixed(1)}% F1
                          </h4>
                          <div className="text-muted small mt-1">Accuracy: {((intel.metrics?.accuracy || 0.98) * 100).toFixed(1)}%</div>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>

                  {/* Charts Row */}
                  <Row className="g-4 mb-4">
                    {/* Typology Frequency Chart */}
                    <Col lg={7}>
                      <Card className="bg-dark border-secondary border-opacity-25 h-100">
                        <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3">
                          <h6 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                            <Layers size={16} className="text-warning" />
                            Financial Crime Typologies Breakdown
                          </h6>
                        </Card.Header>
                        <Card.Body className="p-3" style={{ height: '280px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={intel.typologies || []} margin={{ bottom: 40 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                              <XAxis dataKey="name" stroke="#8b949e" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
                              <YAxis stroke="#8b949e" tick={{ fontSize: 11 }} />
                              <RechartsTooltip contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', color: '#fff' }} />
                              <Bar dataKey="count" fill="#f85149" radius={[4, 4, 0, 0]} name="Transactions" />
                            </BarChart>
                          </ResponsiveContainer>
                        </Card.Body>
                      </Card>
                    </Col>

                    {/* Decision Flow & Risk Distribution */}
                    <Col lg={5}>
                      <Card className="bg-dark border-secondary border-opacity-25 h-100">
                        <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3">
                          <h6 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                            <Activity size={16} className="text-info" />
                            Ground Truth vs Detection
                          </h6>
                        </Card.Header>
                        <Card.Body className="p-3 d-flex flex-column justify-content-center">
                          <div style={{ height: '180px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    { name: 'True Positives (Flagged Fraud)', value: intel.metrics?.confusion_matrix?.tp || 10 },
                                    { name: 'True Negatives (Approved Legit)', value: intel.metrics?.confusion_matrix?.tn || 50 },
                                    { name: 'False Positives (Cleared)', value: intel.metrics?.confusion_matrix?.fp || 1 },
                                    { name: 'False Negatives (Missed)', value: intel.metrics?.confusion_matrix?.fn || 0 },
                                  ]}
                                  dataKey="value"
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={45}
                                  outerRadius={75}
                                  paddingAngle={3}
                                >
                                  {PIE_COLORS.map((c, i) => (
                                    <Cell key={i} fill={c} />
                                  ))}
                                </Pie>
                                <RechartsTooltip contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', color: '#fff' }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="d-flex justify-content-around text-center mt-2 small">
                            <div>
                              <div className="text-success fw-bold">{intel.metrics?.confusion_matrix?.tp || 0}</div>
                              <div className="text-muted" style={{ fontSize: '10.5px' }}>Confirmed TP</div>
                            </div>
                            <div>
                              <div className="text-primary fw-bold">{intel.metrics?.confusion_matrix?.tn || 0}</div>
                              <div className="text-muted" style={{ fontSize: '10.5px' }}>Legit TN</div>
                            </div>
                            <div>
                              <div className="text-warning fw-bold">{intel.metrics?.confusion_matrix?.fp || 0}</div>
                              <div className="text-muted" style={{ fontSize: '10.5px' }}>FP Over-flag</div>
                            </div>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </div>
              )}

              {/* ============================================================ */}
              {/* TAB 2: TRANSACTIONS LEDGER (COLOR CODED, SINGLE BUTTON & PAGINATION) */}
              {/* ============================================================ */}
              {activeTab === 'transactions' && (
                <div>
                  {/* Filter Toolbar */}
                  <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
                    <div className="d-flex gap-2 align-items-center flex-wrap" style={{ flex: 1 }}>
                      <div style={{ maxWidth: '260px', width: '100%' }}>
                        <Form.Control
                          size="sm"
                          type="text"
                          placeholder="Search Txn ID, Account, Typology..."
                          value={txSearch}
                          onChange={(e) => {
                            setTxSearch(e.target.value);
                            setTxPage(1);
                          }}
                          style={{ background: '#121215', borderColor: '#27272a', color: '#fff' }}
                        />
                      </div>

                      <Form.Select
                        size="sm"
                        value={txStatusFilter}
                        onChange={(e) => {
                          setTxStatusFilter(e.target.value);
                          setTxPage(1);
                        }}
                        style={{ maxWidth: '170px', background: '#121215', borderColor: '#27272a', color: '#fff' }}
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="LEGIT">🟢 Safe / Legit</option>
                        <option value="MODERATE">🟡 Moderate Risk</option>
                        <option value="FRAUD">🔴 Danger / Fraud</option>
                      </Form.Select>

                      <Form.Select
                        size="sm"
                        value={txTypologyFilter}
                        onChange={(e) => {
                          setTxTypologyFilter(e.target.value);
                          setTxPage(1);
                        }}
                        style={{ maxWidth: '200px', background: '#121215', borderColor: '#27272a', color: '#fff' }}
                      >
                        <option value="">All Typologies</option>
                        {intel.typologies?.map((typ) => (
                          <option key={typ.id} value={typ.id}>
                            {typ.id} — {typ.name}
                          </option>
                        ))}
                      </Form.Select>

                      <Form.Select
                        size="sm"
                        value={txDecisionFilter}
                        onChange={(e) => {
                          setTxDecisionFilter(e.target.value);
                          setTxPage(1);
                        }}
                        style={{ maxWidth: '150px', background: '#121215', borderColor: '#27272a', color: '#fff' }}
                      >
                        <option value="">All Decisions</option>
                        <option value="APPROVE">APPROVE (Legit)</option>
                        <option value="FLAG">FLAG (Suspicious)</option>
                        <option value="HOLD">HOLD</option>
                        <option value="REJECT">REJECT (Fraud)</option>
                      </Form.Select>
                    </div>

                    <div className="d-flex align-items-center gap-3">
                      <div className="text-muted small">
                        Showing <strong>{filteredTransactions.length}</strong> transactions
                      </div>
                      <Form.Select
                        size="sm"
                        value={txPageSize}
                        onChange={(e) => {
                          setTxPageSize(Number(e.target.value));
                          setTxPage(1);
                        }}
                        style={{ width: '100px', background: '#121215', borderColor: '#27272a', color: '#fff' }}
                      >
                        <option value={15}>15 / page</option>
                        <option value={25}>25 / page</option>
                        <option value={50}>50 / page</option>
                        <option value={100}>100 / page</option>
                      </Form.Select>
                    </div>
                  </div>

                  {/* Transactions Table with Dynamic Border & BG per Status */}
                  <div className="table-responsive rounded-2" style={{ background: '#121215', border: '1px solid #27272a' }}>
                    <Table hover variant="dark" className="align-middle mb-0 text-nowrap" style={{ fontSize: '12px', background: 'transparent' }}>
                      <thead>
                        <tr className="text-muted border-secondary border-opacity-25" style={{ background: '#18181b' }}>
                          <th>Txn ID</th>
                          <th>Timestamp</th>
                          <th>Sender Account</th>
                          <th>Receiver Account</th>
                          <th>Amount (USD)</th>
                          <th>Typology</th>
                          <th>Ground Truth</th>
                          <th>Decision</th>
                          <th>Risk Score</th>
                          <th>Override Action</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="text-center py-4 text-muted">
                              No transactions match the selected filter criteria.
                            </td>
                          </tr>
                        ) : (
                          paginatedTransactions.map((tx) => {
                            const isFraud = tx.synthetic_ground_truth === 'fraudulent' || tx.final_decision in { FLAG: 1, HOLD: 1, REJECT: 1 };
                            const style = getEntityStatusStyle(isFraud, tx.risk_score || 0.5, isFraud);
                            const isTxLoading = txActionLoading[tx.transaction_id];

                            // Receiver status lookup for quick badge
                            const receiverAcc = accountsMap[tx.receiver_account];
                            const receiverIsFraud = receiverAcc ? receiverAcc.risk_score >= 0.65 || receiverAcc.is_flagged : false;
                            const receiverStyle = getEntityStatusStyle(receiverIsFraud, receiverAcc?.risk_score || 0.5, receiverIsFraud);

                            return (
                              <tr
                                key={tx.id || tx.transaction_id}
                                style={{
                                  background: style.bg,
                                  borderLeft: `4px solid ${style.color}`,
                                  borderColor: style.border,
                                }}
                              >
                                <td className="font-monospace text-muted small">{tx.transaction_id}</td>
                                <td className="text-muted small">{tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString() : '—'}</td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedAccountId(tx.sender_account);
                                      setHighlightedNodeId(tx.sender_account);
                                    }}
                                    className="btn btn-link p-0 text-decoration-none font-monospace text-warning fw-semibold small"
                                    title="Click to view complete account forensics"
                                  >
                                    {tx.sender_account}
                                  </button>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedAccountId(tx.receiver_account);
                                      setHighlightedNodeId(tx.receiver_account);
                                    }}
                                    className="btn btn-link p-0 text-decoration-none font-monospace fw-semibold small"
                                    style={{ color: receiverStyle.color }}
                                    title={`Receiver Risk: ${( (receiverAcc?.risk_score || 0.5) * 100).toFixed(0)}%`}
                                  >
                                    {tx.receiver_account}
                                  </button>
                                </td>
                                <td className="font-monospace text-white fw-bold">
                                  ${parseFloat(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td>
                                  <Badge bg="dark" className="border border-secondary" style={{ fontSize: '10.5px' }}>
                                    {tx.scenario_name || tx.scenario_id || 'Standard'}
                                  </Badge>
                                </td>
                                <td>
                                  <Badge bg={tx.synthetic_ground_truth === 'fraudulent' ? 'danger' : 'success'}>
                                    {tx.synthetic_ground_truth || 'legitimate'}
                                  </Badge>
                                </td>
                                <td>
                                  <Badge
                                    bg={style.badgeBg}
                                    className="text-uppercase font-monospace"
                                  >
                                    {tx.final_decision || 'APPROVE'}
                                  </Badge>
                                </td>
                                <td className="font-monospace fw-bold" style={{ color: style.color }}>
                                  {((tx.risk_score || 0) * 100).toFixed(0)}%
                                </td>
                                <td>
                                  {/* SINGLE DYNAMIC BUTTON BASED ON STATUS */}
                                  {isFraud ? (
                                    <Button
                                      size="sm"
                                      variant="success"
                                      disabled={isTxLoading}
                                      style={{ fontSize: '11px', padding: '3px 10px', fontWeight: 600 }}
                                      onClick={() => handleTxToggle(tx.transaction_id, true)}
                                      title="Mark transaction as Legitimate / Approved (Turns Green)"
                                      className="d-inline-flex align-items-center gap-1"
                                    >
                                      {isTxLoading ? <Spinner size="sm" animation="border" /> : <Check size={12} />}
                                      Mark as Legit
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline-danger"
                                      disabled={isTxLoading}
                                      style={{ fontSize: '11px', padding: '3px 10px', fontWeight: 600 }}
                                      onClick={() => handleTxToggle(tx.transaction_id, false)}
                                      title="Flag transaction as Fraud / Rejected (Turns Red)"
                                      className="d-inline-flex align-items-center gap-1"
                                    >
                                      {isTxLoading ? <Spinner size="sm" animation="border" /> : <X size={12} />}
                                      Flag as Fraud
                                    </Button>
                                  )}
                                </td>
                                <td>
                                  <Button
                                    size="sm"
                                    variant="outline-secondary"
                                    style={{ fontSize: '10.5px', padding: '2px 8px' }}
                                    onClick={() => handleOpenNoteModal('TRANSACTION', tx.transaction_id)}
                                    title="Add forensic note for this transaction"
                                  >
                                    <MessageSquare size={11} /> Note
                                  </Button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </Table>
                  </div>

                  {/* Pagination Controls */}
                  {totalTxPages > 1 && (
                    <div className="d-flex justify-content-between align-items-center mt-3">
                      <div className="text-muted small">
                        Page <strong>{txPage}</strong> of <strong>{totalTxPages}</strong> ({filteredTransactions.length} total items)
                      </div>
                      <div className="d-flex gap-1">
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          disabled={txPage === 1}
                          onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                        >
                          &laquo; Prev
                        </Button>
                        {Array.from({ length: Math.min(5, totalTxPages) }, (_, i) => {
                          const p = i + 1;
                          return (
                            <Button
                              key={p}
                              size="sm"
                              variant={txPage === p ? 'primary' : 'outline-secondary'}
                              onClick={() => setTxPage(p)}
                            >
                              {p}
                            </Button>
                          );
                        })}
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          disabled={txPage === totalTxPages}
                          onClick={() => setTxPage((p) => Math.min(totalTxPages, p + 1))}
                        >
                          Next &raquo;
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================ */}
              {/* TAB 3: ACCOUNT FORENSICS VIEWER & HUB */}
              {/* ============================================================ */}
              {activeTab === 'accounts' && (
                <div>
                  {/* Account Hub Toolbar */}
                  <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
                    <div className="d-flex gap-2 align-items-center flex-wrap" style={{ flex: 1 }}>
                      <div style={{ maxWidth: '260px', width: '100%' }}>
                        <Form.Control
                          size="sm"
                          type="text"
                          placeholder="Search Account ID or Archetype..."
                          value={accSearch}
                          onChange={(e) => setAccSearch(e.target.value)}
                          style={{ background: '#121215', borderColor: '#27272a', color: '#fff' }}
                        />
                      </div>

                      <Form.Select
                        size="sm"
                        value={accFilterStatus}
                        onChange={(e) => setAccFilterStatus(e.target.value)}
                        style={{ maxWidth: '170px', background: '#121215', borderColor: '#27272a', color: '#fff' }}
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="CRITICAL">🔴 Critical / Fraud</option>
                        <option value="MODERATE">🟡 Moderate Risk</option>
                        <option value="SAFE">🟢 Safe / Cleared</option>
                        <option value="FROZEN">❄ Frozen Accounts</option>
                      </Form.Select>

                      <Form.Select
                        size="sm"
                        value={accSortBy}
                        onChange={(e) => setAccSortBy(e.target.value)}
                        style={{ maxWidth: '190px', background: '#121215', borderColor: '#27272a', color: '#fff' }}
                      >
                        <option value="risk_desc">Sort: Highest Risk</option>
                        <option value="risk_asc">Sort: Lowest Risk</option>
                        <option value="inflow_desc">Sort: Highest Inflow</option>
                        <option value="outflow_desc">Sort: Highest Outflow</option>
                        <option value="degree_desc">Sort: Most Counterparties</option>
                      </Form.Select>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      <Button
                        size="sm"
                        variant={accViewMode === 'grid' ? 'primary' : 'outline-secondary'}
                        onClick={() => setAccViewMode('grid')}
                        title="Forensic Card Grid View"
                      >
                        <Grid size={13} />
                      </Button>
                      <Button
                        size="sm"
                        variant={accViewMode === 'table' ? 'primary' : 'outline-secondary'}
                        onClick={() => setAccViewMode('table')}
                        title="Structured Table View"
                      >
                        <List size={13} />
                      </Button>
                      <Badge bg="secondary" className="ms-2">{processedAccounts.length} Entities</Badge>
                    </div>
                  </div>

                  {/* Optional: "Between Accounts" Transactions Inspection Banner */}
                  {betweenPair && (
                    <Alert variant="info" className="d-flex justify-content-between align-items-center py-2 px-3 mb-3 bg-info bg-opacity-10 border-info border-opacity-25 text-info">
                      <div className="d-flex align-items-center gap-2 small">
                        <ArrowLeftRight size={14} />
                        <span>
                          Inspecting flow between <strong>{betweenPair.accountA}</strong> &harr; <strong>{betweenPair.accountB}</strong> ({betweenTransactions.length} direct transfers)
                        </span>
                      </div>
                      <div className="d-flex gap-2">
                        <Button
                          size="sm"
                          variant="outline-info"
                          style={{ fontSize: '11px', padding: '2px 8px' }}
                          onClick={() => {
                            setTxSearch(betweenPair.accountA);
                            setActiveTab('transactions');
                          }}
                        >
                          View in All Txns
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          style={{ fontSize: '11px', padding: '2px 8px' }}
                          onClick={() => setBetweenPair(null)}
                        >
                          Close Inspection
                        </Button>
                      </div>
                    </Alert>
                  )}

                  {/* GRID CARD VIEW OF ACCOUNTS */}
                  {accViewMode === 'grid' ? (
                    <Row className="g-3">
                      {processedAccounts.length === 0 ? (
                        <Col xs={12}>
                          <div className="text-center py-5 text-muted">
                            No accounts match the selected criteria.
                          </div>
                        </Col>
                      ) : (
                        processedAccounts.map((acc) => {
                          const isFraud = acc.risk_score >= 0.65 || acc.is_flagged;
                          const style = getEntityStatusStyle(isFraud, acc.risk_score, isFraud);
                          const isAccLoading = accActionLoading[acc.account_id];

                          return (
                            <Col lg={4} md={6} key={acc.account_id}>
                              <Card
                                className="h-100 transition-all"
                                style={{
                                  background: style.bg,
                                  border: `1px solid ${acc.is_frozen ? '#58a6ff' : style.border}`,
                                  boxShadow: acc.is_frozen ? '0 0 12px rgba(88,166,255,0.2)' : 'none',
                                }}
                              >
                                <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-2.5 d-flex justify-content-between align-items-center">
                                  <div className="d-flex align-items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedAccountId(acc.account_id);
                                        setHighlightedNodeId(acc.account_id);
                                      }}
                                      className="btn btn-link p-0 text-decoration-none font-monospace fw-bold text-white fs-6"
                                      title="Inspect Account Deep Forensics"
                                    >
                                      {acc.account_id}
                                    </button>
                                    {acc.is_frozen && (
                                      <Badge bg="info" className="d-inline-flex align-items-center gap-1" style={{ fontSize: '10px' }}>
                                        <Snowflake size={10} /> FROZEN
                                      </Badge>
                                    )}
                                  </div>
                                  <Badge
                                    style={{
                                      backgroundColor: `${style.color}22`,
                                      color: style.color,
                                      border: `1px solid ${style.color}66`,
                                      fontSize: '11px',
                                    }}
                                  >
                                    {(acc.risk_score * 100).toFixed(0)}% RISK
                                  </Badge>
                                </Card.Header>

                                <Card.Body className="p-3 d-flex flex-column justify-content-between">
                                  <div>
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                      <span className="text-muted small">Archetype:</span>
                                      <span className="small text-white fw-semibold">{isFraud ? acc.role : 'Verified Safe Entity'}</span>
                                    </div>

                                    {/* Flow Metrics */}
                                    <Row className="g-2 text-center my-2 p-2 rounded-2" style={{ background: '#121215', border: '1px solid #27272a' }}>
                                      <Col xs={4}>
                                        <div className="text-muted" style={{ fontSize: '10px' }}>INFLOW</div>
                                        <div className="font-monospace text-success small fw-bold">
                                          ${(acc.inflow_total || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                      </Col>
                                      <Col xs={4}>
                                        <div className="text-muted" style={{ fontSize: '10px' }}>OUTFLOW</div>
                                        <div className="font-monospace text-danger small fw-bold">
                                          ${(acc.outflow_total || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                      </Col>
                                      <Col xs={4}>
                                        <div className="text-muted" style={{ fontSize: '10px' }}>TRANSFERS</div>
                                        <div className="font-monospace text-white small fw-bold">
                                          {acc.total_tx_count || (acc.tx_in_count + acc.tx_out_count)}
                                        </div>
                                      </Col>
                                    </Row>

                                    {/* Counterparties with Receiver Status Color Coding */}
                                    <div className="mt-2 mb-3">
                                      <div className="d-flex justify-content-between align-items-center mb-1">
                                        <span className="text-muted" style={{ fontSize: '11px' }}>
                                          Counterparties ({acc.counterparties?.length || 0}):
                                        </span>
                                        <span className="text-muted" style={{ fontSize: '10px' }}>Click to view flow</span>
                                      </div>
                                      <div className="d-flex gap-1 flex-wrap" style={{ maxHeight: '60px', overflowY: 'auto' }}>
                                        {acc.counterparties?.length === 0 ? (
                                          <span className="text-muted small">None</span>
                                        ) : (
                                          acc.counterparties?.map((cp) => {
                                            const cpAcc = accountsMap[cp];
                                            const cpIsFraud = cpAcc ? cpAcc.risk_score >= 0.65 || cpAcc.is_flagged : false;
                                            const cpStyle = getEntityStatusStyle(cpIsFraud, cpAcc?.risk_score || 0.5, cpIsFraud);
                                            return (
                                              <button
                                                key={cp}
                                                type="button"
                                                onClick={() => setBetweenPair({ accountA: acc.account_id, accountB: cp })}
                                                className="btn btn-sm py-0 px-1.5 font-monospace text-nowrap"
                                                style={{
                                                  fontSize: '10px',
                                                  backgroundColor: cpStyle.bg,
                                                  color: cpStyle.color,
                                                  border: `1px solid ${cpStyle.border}`,
                                                }}
                                                title={`Click to inspect flow with ${cp} (Risk: ${((cpAcc?.risk_score || 0.5) * 100).toFixed(0)}%)`}
                                              >
                                                {cp}
                                              </button>
                                            );
                                          })
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Action Buttons: Single Toggle, Freeze, Inspect, Note */}
                                  <div className="pt-2 border-top border-secondary border-opacity-25 d-flex gap-1.5 align-items-center flex-wrap">
                                    {/* SINGLE DYNAMIC OVERRIDE BUTTON */}
                                    {isFraud ? (
                                      <Button
                                        size="sm"
                                        variant="success"
                                        disabled={isAccLoading}
                                        style={{ fontSize: '11px', flex: 1 }}
                                        onClick={() => handleAccountToggle(acc.account_id, true)}
                                        title="Mark all transactions of this account as legit (Turns Green)"
                                        className="d-inline-flex align-items-center justify-content-center gap-1"
                                      >
                                        {isAccLoading ? <Spinner size="sm" animation="border" /> : <Check size={12} />}
                                        Mark Legit
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline-danger"
                                        disabled={isAccLoading}
                                        style={{ fontSize: '11px', flex: 1 }}
                                        onClick={() => handleAccountToggle(acc.account_id, false)}
                                        title="Flag entire account and all transactions as fraud (Turns Red)"
                                        className="d-inline-flex align-items-center justify-content-center gap-1"
                                      >
                                        {isAccLoading ? <Spinner size="sm" animation="border" /> : <X size={12} />}
                                        Flag Fraud
                                      </Button>
                                    )}

                                    {/* FREEZE / UNFREEZE TOGGLE */}
                                    <Button
                                      size="sm"
                                      variant={acc.is_frozen ? 'info' : 'outline-info'}
                                      disabled={isAccLoading}
                                      style={{ fontSize: '11px' }}
                                      onClick={() => handleFreezeToggle(acc.account_id, acc.is_frozen)}
                                      title={acc.is_frozen ? 'Unfreeze Account' : 'Freeze Account & Halt Transfers'}
                                    >
                                      <Snowflake size={11} /> {acc.is_frozen ? 'Frozen' : 'Freeze'}
                                    </Button>

                                    {/* INSPECT POPUP */}
                                    <Button
                                      size="sm"
                                      variant="outline-light"
                                      style={{ fontSize: '11px' }}
                                      onClick={() => {
                                        setSelectedAccountId(acc.account_id);
                                        setHighlightedNodeId(acc.account_id);
                                      }}
                                      title="Open Deep Forensics Popup"
                                    >
                                      <Eye size={11} />
                                    </Button>

                                    {/* NOTE BUTTON */}
                                    <Button
                                      size="sm"
                                      variant="outline-secondary"
                                      style={{ fontSize: '11px' }}
                                      onClick={() => handleOpenNoteModal('ACCOUNT', acc.account_id)}
                                      title="Add investigator note for this account"
                                    >
                                      <MessageSquare size={11} />
                                    </Button>
                                  </div>
                                </Card.Body>
                              </Card>
                            </Col>
                          );
                        })
                      )}
                    </Row>
                  ) : (
                    /* STRUCTURED TABLE VIEW */
                    <div className="table-responsive rounded-2" style={{ background: '#121215', border: '1px solid #27272a' }}>
                      <Table hover variant="dark" className="align-middle mb-0 text-nowrap" style={{ fontSize: '12px', background: 'transparent' }}>
                        <thead>
                          <tr className="text-muted border-secondary border-opacity-25" style={{ background: '#18181b' }}>
                            <th>Account ID</th>
                            <th>Status & Archetype</th>
                            <th>Risk Score</th>
                            <th>Total Inflow</th>
                            <th>Total Outflow</th>
                            <th>Net Flow</th>
                            <th>Counterparties</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {processedAccounts.map((acc) => {
                            const isFraud = acc.risk_score >= 0.65 || acc.is_flagged;
                            const style = getEntityStatusStyle(isFraud, acc.risk_score, isFraud);
                            const isAccLoading = accActionLoading[acc.account_id];

                            return (
                              <tr
                                key={acc.account_id}
                                style={{
                                  background: style.bg,
                                  borderLeft: `4px solid ${acc.is_frozen ? '#58a6ff' : style.color}`,
                                  borderColor: style.border,
                                }}
                              >
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedAccountId(acc.account_id);
                                      setHighlightedNodeId(acc.account_id);
                                    }}
                                    className="btn btn-link p-0 text-decoration-none font-monospace fw-bold text-white small"
                                  >
                                    {acc.account_id}
                                  </button>
                                  {acc.is_frozen && (
                                    <Badge bg="info" className="ms-1 font-monospace" style={{ fontSize: '9.5px' }}>
                                      ❄ FROZEN
                                    </Badge>
                                  )}
                                </td>
                                <td>
                                  <Badge bg={style.badgeBg} className="me-1">
                                    {style.badgeText}
                                  </Badge>
                                  <span className="text-muted small">{isFraud ? acc.role : 'Verified Safe Entity'}</span>
                                </td>
                                <td className="font-monospace fw-bold" style={{ color: style.color }}>
                                  {(acc.risk_score * 100).toFixed(1)}%
                                </td>
                                <td className="font-monospace text-success">
                                  ${acc.inflow_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="font-monospace text-danger">
                                  ${acc.outflow_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="font-monospace text-white fw-bold">
                                  ${acc.net_flow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td>
                                  <div className="d-flex gap-1 flex-wrap" style={{ maxWidth: '200px' }}>
                                    {acc.counterparties?.slice(0, 3).map((cp) => {
                                      const cpAcc = accountsMap[cp];
                                      const cpIsFraud = cpAcc ? cpAcc.risk_score >= 0.65 || cpAcc.is_flagged : false;
                                      const cpStyle = getEntityStatusStyle(cpIsFraud, cpAcc?.risk_score || 0.5, cpIsFraud);
                                      return (
                                        <button
                                          key={cp}
                                          type="button"
                                          onClick={() => setBetweenPair({ accountA: acc.account_id, accountB: cp })}
                                          className="btn btn-sm py-0 px-1 font-monospace"
                                          style={{ fontSize: '10px', color: cpStyle.color, border: `1px solid ${cpStyle.border}`, background: cpStyle.bg }}
                                        >
                                          {cp}
                                        </button>
                                      );
                                    })}
                                    {acc.counterparties?.length > 3 && (
                                      <span className="text-muted small">+{acc.counterparties.length - 3}</span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex gap-1 align-items-center">
                                    {isFraud ? (
                                      <Button
                                        size="sm"
                                        variant="success"
                                        disabled={isAccLoading}
                                        style={{ fontSize: '10.5px', padding: '2px 8px' }}
                                        onClick={() => handleAccountToggle(acc.account_id, true)}
                                        title="Mark entire account as legit"
                                      >
                                        <Check size={11} /> Mark Legit
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline-danger"
                                        disabled={isAccLoading}
                                        style={{ fontSize: '10.5px', padding: '2px 8px' }}
                                        onClick={() => handleAccountToggle(acc.account_id, false)}
                                        title="Flag entire account as fraud"
                                      >
                                        <X size={11} /> Flag Fraud
                                      </Button>
                                    )}

                                    <Button
                                      size="sm"
                                      variant={acc.is_frozen ? 'info' : 'outline-info'}
                                      disabled={isAccLoading}
                                      style={{ fontSize: '10.5px', padding: '2px 6px' }}
                                      onClick={() => handleFreezeToggle(acc.account_id, acc.is_frozen)}
                                      title={acc.is_frozen ? 'Unfreeze' : 'Freeze'}
                                    >
                                      <Snowflake size={11} />
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline-primary"
                                      style={{ fontSize: '10.5px', padding: '2px 8px' }}
                                      onClick={() => {
                                        setSelectedAccountId(acc.account_id);
                                        setHighlightedNodeId(acc.account_id);
                                      }}
                                    >
                                      Inspect
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline-secondary"
                                      style={{ fontSize: '10.5px', padding: '2px 6px' }}
                                      onClick={() => handleOpenNoteModal('ACCOUNT', acc.account_id)}
                                      title="Add note"
                                    >
                                      <MessageSquare size={11} />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================ */}
              {/* TAB 4: FRAUDS & ALERTS DECISIONING (SEARCH, SORT, FILTER, INSTANT TRIAGE) */}
              {/* ============================================================ */}
              {activeTab === 'frauds' && (
                <div>
                  {/* Step-by-Step Investigator SOP Guide */}
                  <Card style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8 }} className="mb-3">
                    <Card.Body className="p-3">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="d-flex align-items-center gap-2">
                          <Zap size={15} color="#e3b341" />
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#f0f6fc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Investigator Signal Triage Guide
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: '#8b949e' }}>
                          Strict One-Way Triage: Actioned alerts are automatically cleared from the pending queue
                        </span>
                      </div>
                      <div className="row g-2">
                        {[
                          { num: 1, title: 'Step 1: Signal Triage', desc: 'Scan DC-LCG anomaly triggers & risk tiers in pending queue' },
                          { num: 2, title: 'Step 2: Inspect Accounts & Txns', desc: 'Click account badges below to view deep forensic flow metrics' },
                          { num: 3, title: 'Step 3: Classify Legit vs. Fraud', desc: 'One-way determination with verification confirmation' },
                          { num: 4, title: 'Step 4: Formal Case Synthesis', desc: 'Confirmed motifs automatically bind to SAR report draft' },
                        ].map((step) => {
                          const isCurrent = (alertStatusFilter === 'NEW' && step.num === 1) || (alertStatusFilter === 'DISMISSED' && step.num === 3) || (alertStatusFilter === 'CONFIRMED' && step.num === 4);
                          return (
                            <div key={step.num} className="col-12 col-md-3">
                              <div
                                style={{
                                  background: isCurrent ? 'rgba(56,139,253,0.12)' : '#161b22',
                                  border: `1px solid ${isCurrent ? '#388bfd' : '#30363d'}`,
                                  borderRadius: 6,
                                  padding: '8px 10px',
                                  height: '100%',
                                }}
                              >
                                <div className="d-flex align-items-center gap-2 mb-1">
                                  <span
                                    style={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: '50%',
                                      background: isCurrent ? '#1f6feb' : '#21262d',
                                      color: isCurrent ? '#ffffff' : '#8b949e',
                                      fontSize: 10,
                                      fontWeight: 700,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    {step.num}
                                  </span>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: isCurrent ? '#58a6ff' : '#f0f6fc' }}>
                                    {step.title}
                                  </span>
                                </div>
                                <div style={{ fontSize: 10, color: '#8b949e', lineHeight: 1.3, paddingLeft: 26 }}>
                                  {step.desc}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card.Body>
                  </Card>

                  {/* Quick Triage Category Buttons */}
                  <div className="d-flex gap-2 flex-wrap mb-3">
                    <button
                      type="button"
                      onClick={() => setAlertStatusFilter('NEW')}
                      style={{
                        background: alertStatusFilter === 'NEW' ? '#1f6feb' : '#161b22',
                        color: alertStatusFilter === 'NEW' ? '#ffffff' : '#8b949e',
                        border: `1px solid ${alertStatusFilter === 'NEW' ? '#388bfd' : '#30363d'}`,
                        borderRadius: 6,
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      🟡 Pending Triage ({intel.alerts?.filter((a) => a.status === 'NEW').length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAlertStatusFilter('CONFIRMED')}
                      style={{
                        background: alertStatusFilter === 'CONFIRMED' ? '#da3633' : '#161b22',
                        color: alertStatusFilter === 'CONFIRMED' ? '#ffffff' : '#8b949e',
                        border: `1px solid ${alertStatusFilter === 'CONFIRMED' ? '#f85149' : '#30363d'}`,
                        borderRadius: 6,
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      🔴 Confirmed Fraud ({intel.alerts?.filter((a) => a.status === 'TRIAGED' || a.status === 'CONFIRMED_FRAUD').length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAlertStatusFilter('DISMISSED')}
                      style={{
                        background: alertStatusFilter === 'DISMISSED' ? '#238636' : '#161b22',
                        color: alertStatusFilter === 'DISMISSED' ? '#ffffff' : '#8b949e',
                        border: `1px solid ${alertStatusFilter === 'DISMISSED' ? '#2ea043' : '#30363d'}`,
                        borderRadius: 6,
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      🟢 Dismissed / Legit ({intel.alerts?.filter((a) => a.status === 'DISMISSED').length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAlertStatusFilter('ALL')}
                      style={{
                        background: alertStatusFilter === 'ALL' ? '#30363d' : '#161b22',
                        color: alertStatusFilter === 'ALL' ? '#ffffff' : '#8b949e',
                        border: '1px solid #30363d',
                        borderRadius: 6,
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      All Signals ({intel.alerts?.length || 0})
                    </button>
                  </div>

                  {/* Filter Toolbar for Alerts */}
                  <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
                    <div className="d-flex gap-2 align-items-center flex-wrap" style={{ flex: 1 }}>
                      <div style={{ maxWidth: '280px', width: '100%' }}>
                        <Form.Control
                          size="sm"
                          type="text"
                          placeholder="Search alerts by pattern, reason or account..."
                          value={alertSearch}
                          onChange={(e) => setAlertSearch(e.target.value)}
                          style={{ background: '#121215', borderColor: '#27272a', color: '#fff' }}
                        />
                      </div>

                      <Form.Select
                        size="sm"
                        value={alertSortBy}
                        onChange={(e) => setAlertSortBy(e.target.value)}
                        style={{ maxWidth: '180px', background: '#121215', borderColor: '#27272a', color: '#fff' }}
                      >
                        <option value="risk_desc">Sort: Highest Risk</option>
                        <option value="risk_asc">Sort: Lowest Risk</option>
                        <option value="newest">Sort: Newest First</option>
                        <option value="oldest">Sort: Oldest First</option>
                      </Form.Select>
                    </div>

                    <div className="text-muted small">
                      Showing <strong>{processedAlerts.length}</strong> alerts in this view
                    </div>
                  </div>

                  <Row className="g-3">
                    {processedAlerts.length === 0 ? (
                      <Col xs={12}>
                        <div className="text-center py-5 text-muted" style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 8 }}>
                          <CheckCircle size={32} className="text-success mb-2" />
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#c9d1d9' }}>
                            {alertStatusFilter === 'NEW' ? 'No pending unreviewed alerts!' : 'No alerts found in this view.'}
                          </div>
                          <div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>
                            {alertStatusFilter === 'NEW' ? 'All anomaly signals have been classified as Legit or Confirmed Fraud.' : 'Try changing your category tab or search query.'}
                          </div>
                        </div>
                      </Col>
                    ) : (
                      processedAlerts.map((al) => {
                        const isAlertLoading = alertActionLoading[al.id];
                        const isPending = al.status === 'NEW';
                        const isDismissed = al.status === 'DISMISSED';
                        const isConfirmed = al.status === 'TRIAGED' || al.status === 'CONFIRMED_FRAUD';
                        const isEscalated = al.status === 'ESCALATED';

                        return (
                          <Col md={6} key={al.id}>
                            <Card
                              className="h-100"
                              style={{
                                background: isDismissed ? 'rgba(63,185,80,0.06)' : isConfirmed ? 'rgba(248,81,73,0.06)' : '#121215',
                                border: `1px solid ${isDismissed ? 'rgba(63,185,80,0.3)' : isConfirmed ? 'rgba(248,81,73,0.3)' : '#27272a'}`,
                              }}
                            >
                              <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-2.5 d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center gap-2">
                                  <ShieldAlert size={16} className={isDismissed ? 'text-success' : 'text-danger'} />
                                  <span className="fw-bold text-white small">Alert #{al.id}</span>
                                  <Badge bg="dark" className="border border-secondary">{typeof al.pattern_name === 'string' ? al.pattern_name : (al.alert_type || 'ANOMALY_SIGNAL')}</Badge>
                                </div>
                                <Badge bg={isPending ? 'warning' : isConfirmed ? 'danger' : isDismissed ? 'success' : 'secondary'}>
                                  {isPending ? 'PENDING TRIAGE' : isConfirmed ? 'CONFIRMED FRAUD' : isDismissed ? 'DISMISSED / LEGIT' : al.status}
                                </Badge>
                              </Card.Header>

                              <Card.Body className="p-3 d-flex flex-column justify-content-between">
                                <div>
                                  <p className="small text-muted mb-2">{getReasonText(al.trigger_reason) || getReasonText(al.detection_reason) || 'Algorithmic anomaly trigger'}</p>

                                  <div className="d-flex justify-content-between align-items-center mb-3 small">
                                    <span className="text-muted">Assessed Risk Score:</span>
                                    <span
                                      className="font-monospace fw-bold fs-6"
                                      style={{ color: (al.risk_score || 0.8) >= 0.7 ? '#f85149' : '#3fb950' }}
                                    >
                                      {((al.risk_score || 0.8) * 100).toFixed(0)}%
                                    </span>
                                  </div>

                                  {al.related_accounts?.length > 0 && (
                                    <div className="mb-3 small">
                                      <div className="d-flex justify-content-between align-items-center mb-1">
                                        <span className="text-muted">Related Accounts (Click to Inspect):</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedAccountId(al.related_accounts[0]);
                                            setHighlightedNodeId(al.related_accounts[0]);
                                          }}
                                          className="btn btn-link p-0 text-decoration-none"
                                          style={{ fontSize: '11px', color: '#58a6ff' }}
                                        >
                                          Forensics Drilldown →
                                        </button>
                                      </div>
                                      <div className="d-flex gap-1.5 flex-wrap">
                                        {al.related_accounts.map((acc) => {
                                          const accData = accountsMap[acc];
                                          const accIsFraud = accData ? accData.risk_score >= 0.65 || accData.is_flagged : false;
                                          const accStyle = getEntityStatusStyle(accIsFraud, accData?.risk_score || 0.5, accIsFraud);
                                          return (
                                            <button
                                              key={acc}
                                              type="button"
                                              onClick={() => {
                                                setSelectedAccountId(acc);
                                                setHighlightedNodeId(acc);
                                              }}
                                              className="btn btn-sm py-0 px-2 font-monospace"
                                              style={{
                                                fontSize: '11px',
                                                color: accStyle.color,
                                                border: `1px solid ${accStyle.border}`,
                                                background: accStyle.bg,
                                              }}
                                              title={`Inspect Account ${acc} (Risk: ${((accData?.risk_score || 0.5) * 100).toFixed(0)}%)`}
                                            >
                                              {acc}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Action Buttons for Pending or Final Status Display for Actioned */}
                                {isPending ? (
                                  <div className="d-flex gap-2 pt-2 border-top border-secondary border-opacity-25 mt-2">
                                    <Button
                                      size="sm"
                                      variant="outline-danger"
                                      disabled={isAlertLoading}
                                      onClick={() => setAlertConfirmTarget({ alertId: al.id, action: 'CONFIRM_FRAUD', patternName: al.pattern_name, triggerReason: getReasonText(al.trigger_reason) || getReasonText(al.detection_reason) })}
                                      className="d-flex align-items-center gap-1 flex-fill justify-content-center"
                                      style={{ fontSize: '11px' }}
                                    >
                                      {isAlertLoading ? <Spinner size="sm" animation="border" /> : <Check size={12} />}
                                      Approve Fraud
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline-success"
                                      disabled={isAlertLoading}
                                      onClick={() => setAlertConfirmTarget({ alertId: al.id, action: 'DISMISS', patternName: al.pattern_name, triggerReason: getReasonText(al.trigger_reason) || getReasonText(al.detection_reason) })}
                                      className="d-flex align-items-center gap-1 flex-fill justify-content-center"
                                      style={{ fontSize: '11px' }}
                                    >
                                      {isAlertLoading ? <Spinner size="sm" animation="border" /> : <X size={12} />}
                                      Mark as Legit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline-warning"
                                      disabled={isAlertLoading}
                                      onClick={() => setAlertConfirmTarget({ alertId: al.id, action: 'ESCALATE', patternName: al.pattern_name, triggerReason: getReasonText(al.trigger_reason) || getReasonText(al.detection_reason) })}
                                      className="d-flex align-items-center gap-1"
                                      style={{ fontSize: '11px' }}
                                    >
                                      Escalate
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="pt-2 border-top border-secondary border-opacity-25 mt-2">
                                    <div
                                      style={{
                                        padding: '4px 8px',
                                        borderRadius: 4,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        textAlign: 'center',
                                        background: isDismissed ? 'rgba(63,185,80,0.15)' : isConfirmed ? 'rgba(248,81,73,0.15)' : 'rgba(227,179,65,0.15)',
                                        color: isDismissed ? '#3fb950' : isConfirmed ? '#ff7b72' : '#e3b341',
                                        border: `1px solid ${isDismissed ? 'rgba(63,185,80,0.3)' : isConfirmed ? 'rgba(248,81,73,0.3)' : 'rgba(227,179,65,0.3)'}`,
                                      }}
                                    >
                                      {isDismissed ? '✓ Cleared as Legitimate (Removed from Pending Queue)' : isConfirmed ? '🚨 Confirmed as Fraud (Bound to Case Intelligence)' : '⚠️ Escalated to SAR Review'}
                                    </div>
                                  </div>
                                )}
                              </Card.Body>
                            </Card>
                          </Col>
                        );
                      })
                    )}
                  </Row>
                </div>
              )}

              {/* ============================================================ */}
              {/* TAB 5: MODEL EVALUATION & MATRIX */}
              {/* ============================================================ */}
              {activeTab === 'evaluation' && (
                <div>
                  <Row className="g-4 mb-4">
                    {/* Confusion Matrix Visual */}
                    <Col lg={6}>
                      <Card className="bg-dark border-secondary border-opacity-25 h-100">
                        <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3">
                          <h6 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                            <Zap size={16} className="text-warning" />
                            Live Model Confusion Matrix
                          </h6>
                        </Card.Header>
                        <Card.Body className="p-3">
                          <div className="table-responsive">
                            <table className="table table-bordered table-dark text-center align-middle mb-0" style={{ fontSize: '13px' }}>
                              <thead>
                                <tr>
                                  <th style={{ background: '#121215', borderColor: '#27272a' }}>Actual \ Predicted</th>
                                  <th style={{ background: '#18181b', color: '#f85149', borderColor: '#27272a' }}>Predicted Fraud</th>
                                  <th style={{ background: '#18181b', color: '#3fb950', borderColor: '#27272a' }}>Predicted Legit</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <th style={{ background: '#18181b', color: '#f85149', borderColor: '#27272a' }}>Actual Fraud</th>
                                  <td style={{ background: 'rgba(248,81,73,0.18)', borderColor: '#27272a' }}>
                                    <div className="fw-bold font-monospace fs-5 text-danger">{intel.metrics?.confusion_matrix?.tp || 0}</div>
                                    <div className="text-muted small" style={{ fontSize: '10.5px' }}>True Positive (TP)</div>
                                  </td>
                                  <td style={{ background: 'rgba(227,179,65,0.12)', borderColor: '#27272a' }}>
                                    <div className="fw-bold font-monospace fs-5 text-warning">{intel.metrics?.confusion_matrix?.fn || 0}</div>
                                    <div className="text-muted small" style={{ fontSize: '10.5px' }}>False Negative (FN)</div>
                                  </td>
                                </tr>
                                <tr>
                                  <th style={{ background: '#18181b', color: '#3fb950', borderColor: '#27272a' }}>Actual Legit</th>
                                  <td style={{ background: 'rgba(227,179,65,0.12)', borderColor: '#27272a' }}>
                                    <div className="fw-bold font-monospace fs-5 text-warning">{intel.metrics?.confusion_matrix?.fp || 0}</div>
                                    <div className="text-muted small" style={{ fontSize: '10.5px' }}>False Positive (FP)</div>
                                  </td>
                                  <td style={{ background: 'rgba(63,185,80,0.18)', borderColor: '#27272a' }}>
                                    <div className="fw-bold font-monospace fs-5 text-success">{intel.metrics?.confusion_matrix?.tn || 0}</div>
                                    <div className="text-muted small" style={{ fontSize: '10.5px' }}>True Negative (TN)</div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>

                    {/* Metric Cards */}
                    <Col lg={6}>
                      <Row className="g-3">
                        {[
                          { label: 'Accuracy', val: intel.metrics?.accuracy, desc: 'Overall correct classifications ratio' },
                          { label: 'Precision', val: intel.metrics?.precision, desc: 'Proportion of flagged items that are true fraud' },
                          { label: 'Recall (Detection Rate)', val: intel.metrics?.recall, desc: 'Proportion of actual fraud correctly caught' },
                          { label: 'F1 Score', val: intel.metrics?.f1_score, desc: 'Harmonic mean of precision and recall' },
                          { label: 'False Positive Rate (FPR)', val: intel.metrics?.false_positive_rate, desc: 'Benign transactions falsely escalated' },
                          { label: 'Screening Latency', val: `${intel.metrics?.avg_screening_latency_ms || '< 1.0'} ms`, desc: 'Average sub-millisecond screening throughput' },
                        ].map((m, i) => (
                          <Col sm={6} key={i}>
                            <Card className="bg-dark border-secondary border-opacity-25 h-100">
                              <Card.Body className="p-3">
                                <div className="text-muted small">{m.label}</div>
                                <h4 className="font-monospace fw-bold text-white mt-1 mb-0">
                                  {typeof m.val === 'number' ? `${(m.val * 100).toFixed(1)}%` : m.val}
                                </h4>
                                <div className="text-muted small mt-1" style={{ fontSize: '10.5px' }}>{m.desc}</div>
                              </Card.Body>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    </Col>
                  </Row>
                </div>
              )}

              {/* ============================================================ */}
              {/* TAB 6: NETWORK GRAPH EXPLORER (WITH SELECTED ACCOUNT HIGHLIGHT) */}
              {/* ============================================================ */}
              {activeTab === 'graph' && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="small text-muted">
                      Interactive Case Network Graph &bull; <strong className="text-success">Green</strong> = Safe &bull; <strong className="text-warning">Orange</strong> = Moderate &bull; <strong className="text-danger">Red</strong> = Fraud &bull; <strong className="text-info">Cyan Glow</strong> = Selected Account
                    </span>
                    <div className="d-flex gap-2">
                      {highlightedNodeId && (
                        <Button
                          size="sm"
                          variant="outline-info"
                          className="py-0 px-2"
                          onClick={() => setHighlightedNodeId(null)}
                          style={{ fontSize: '11px' }}
                        >
                          Clear Highlight ({highlightedNodeId})
                        </Button>
                      )}
                      <Button size="sm" variant="outline-secondary" className="py-0 px-2" onClick={() => cyCaseRef.current?.zoom(cyCaseRef.current.zoom() * 1.2)}>
                        <ZoomIn size={13} />
                      </Button>
                      <Button size="sm" variant="outline-secondary" className="py-0 px-2" onClick={() => cyCaseRef.current?.zoom(cyCaseRef.current.zoom() * 0.8)}>
                        <ZoomOut size={13} />
                      </Button>
                      <Button size="sm" variant="outline-secondary" className="py-0 px-2" onClick={() => cyCaseRef.current?.fit()}>
                        <Maximize2 size={13} />
                      </Button>
                    </div>
                  </div>

                  <div
                    ref={cyContainerRef}
                    style={{
                      width: '100%',
                      height: '520px',
                      background: '#090b10',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                    }}
                  />
                </div>
              )}

              {/* ============================================================ */}
              {/* TAB 7: TIMELINE & INVESTIGATOR NOTES */}
              {/* ============================================================ */}
              {activeTab === 'timeline' && (
                <div>
                  <Row className="g-4">
                    {/* Add Note Card */}
                    <Col md={5}>
                      <Card className="bg-dark border-secondary border-opacity-25 mb-4">
                        <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-2.5">
                          <span className="fw-semibold small text-white">Add Investigator Note</span>
                        </Card.Header>
                        <Card.Body className="p-3">
                          <Form onSubmit={handleAddCaseNote}>
                            <Form.Control
                              as="textarea"
                              rows={3}
                              placeholder="Record observations, SAR findings, or account verification results..."
                              value={caseNoteContent}
                              onChange={(e) => setCaseNoteContent(e.target.value)}
                              style={{ background: '#121215', borderColor: '#27272a', color: '#fff', fontSize: '12.5px' }}
                              className="mb-3"
                              required
                            />
                            <Button type="submit" size="sm" variant="primary" disabled={addingCaseNote} className="d-flex align-items-center gap-1">
                              <Send size={13} /> {addingCaseNote ? 'Saving...' : 'Post Case Note'}
                            </Button>
                          </Form>
                        </Card.Body>
                      </Card>
                    </Col>

                    {/* Timeline List */}
                    <Col md={7}>
                      <Card className="bg-dark border-secondary border-opacity-25">
                        <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-2.5">
                          <span className="fw-semibold small text-white">Case Audit Trail & Activity Log</span>
                        </Card.Header>
                        <Card.Body className="p-3" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                          {intel.timeline?.length === 0 ? (
                            <div className="text-muted small text-center py-4">No events logged yet.</div>
                          ) : (
                            <div className="timeline-container">
                              {intel.timeline.map((ev, i) => (
                                <div key={i} className="d-flex gap-3 mb-3 position-relative">
                                  <div className="text-muted small font-monospace" style={{ minWidth: '70px', fontSize: '11px' }}>
                                    {ev.created_at ? new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                  </div>
                                  <div className="p-2 rounded-2 flex-fill" style={{ background: '#121215', border: '1px solid #27272a' }}>
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                      <Badge bg="dark" className="border border-secondary" style={{ fontSize: '10px' }}>
                                        {ev.event_type}
                                      </Badge>
                                      <span className="text-muted" style={{ fontSize: '10px' }}>
                                        {ev.created_at ? new Date(ev.created_at).toLocaleDateString() : ''}
                                      </span>
                                    </div>
                                    <div className="small text-white">{ev.content}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </div>
              )}

              {/* ============================================================ */}
              {/* TAB 8: RISK MAP & TYPOLOGIES */}
              {/* ============================================================ */}
              {activeTab === 'riskmap' && (
                <div>
                  <div className="table-responsive rounded-2" style={{ background: '#121215', border: '1px solid #27272a' }}>
                    <Table hover variant="dark" className="align-middle mb-0 text-nowrap" style={{ fontSize: '12px', background: 'transparent' }}>
                      <thead>
                        <tr className="text-muted border-secondary border-opacity-25" style={{ background: '#18181b' }}>
                          <th>Typology ID</th>
                          <th>Pattern Name</th>
                          <th>Total Transactions</th>
                          <th>Total USD Flow</th>
                          <th>Flagged Illicit Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {intel.typologies?.map((typ) => {
                          const flagRate = typ.count > 0 ? typ.flagged_count / typ.count : 0;
                          return (
                            <tr key={typ.id} className="border-secondary border-opacity-10">
                              <td>
                                <Badge bg="primary" className="font-monospace">{typ.id}</Badge>
                              </td>
                              <td className="text-white fw-semibold">{typ.name}</td>
                              <td className="font-monospace">{typ.count}</td>
                              <td className="font-monospace text-white fw-bold">
                                ${typ.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <ProgressBar
                                    now={flagRate * 100}
                                    variant={flagRate >= 0.7 ? 'danger' : 'warning'}
                                    style={{ height: '6px', width: '80px' }}
                                    className="bg-black"
                                  />
                                  <span className="font-monospace small fw-bold">{(flagRate * 100).toFixed(0)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* TAB 9: CASE FILE & FINAL DECISION */}
              {/* ============================================================ */}
              {activeTab === 'tracking' && (
                <div>
                  <Row className="g-4">
                    {/* Record Final Investigation Decision */}
                    <Col md={6}>
                      <Card className="bg-dark border-secondary border-opacity-25 h-100">
                        <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3">
                          <h6 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                            <CheckCircle size={16} className="text-success" />
                            Formal Investigation Decision
                          </h6>
                        </Card.Header>
                        <Card.Body className="p-3">
                          <Form onSubmit={handleRecordDecision}>
                            <Form.Group className="mb-3">
                              <Form.Label className="small text-muted">Investigation Determination</Form.Label>
                              <Form.Select
                                value={decisionState.decision}
                                onChange={(e) => setDecisionState({ ...decisionState, decision: e.target.value })}
                                style={{ background: '#121215', borderColor: '#27272a', color: '#fff' }}
                              >
                                <option value="SUSPICIOUS_ACTIVITY">SUSPICIOUS ACTIVITY (Confirm SAR Filing)</option>
                                <option value="NO_SUSPICION">NO SUSPICION (Clear & Dismiss)</option>
                                <option value="ESCALATE">ESCALATE (To Compliance / Law Enforcement)</option>
                                <option value="INSUFFICIENT_INFORMATION">INSUFFICIENT INFORMATION</option>
                              </Form.Select>
                            </Form.Group>

                            <Form.Group className="mb-3">
                              <Form.Label className="small text-muted">Reassessed Investigation Risk Score (0.0 to 1.0)</Form.Label>
                              <Form.Control
                                type="number"
                                step="0.05"
                                min="0"
                                max="1"
                                value={decisionState.riskScore}
                                onChange={(e) => setDecisionState({ ...decisionState, riskScore: parseFloat(e.target.value) })}
                                style={{ background: '#121215', borderColor: '#27272a', color: '#fff' }}
                              />
                            </Form.Group>

                            <Form.Group className="mb-3">
                              <Form.Label className="small text-muted">Decision Justification & Evidence Summary</Form.Label>
                              <Form.Control
                                as="textarea"
                                rows={4}
                                placeholder="Summary of findings, confirmed mule rings, and regulatory actions taken..."
                                value={decisionState.reason}
                                onChange={(e) => setDecisionState({ ...decisionState, reason: e.target.value })}
                                style={{ background: '#121215', borderColor: '#27272a', color: '#fff', fontSize: '12.5px' }}
                              />
                            </Form.Group>

                            <Button type="submit" variant="success" size="sm" disabled={savingDecision} className="w-100 py-2 fw-bold">
                              {savingDecision ? 'Recording Decision...' : 'Record Decision & Sync Workflow'}
                            </Button>
                          </Form>
                        </Card.Body>
                      </Card>
                    </Col>

                    {/* Hypotheses Tracker */}
                    <Col md={6}>
                      <Card className="bg-dark border-secondary border-opacity-25 h-100">
                        <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3">
                          <h6 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                            <Info size={16} className="text-primary" />
                            Investigation Hypotheses ({intel.hypotheses?.length || 0})
                          </h6>
                        </Card.Header>
                        <Card.Body className="p-3">
                          <Form onSubmit={handleAddHypothesis} className="mb-3">
                            <Form.Control
                              size="sm"
                              type="text"
                              placeholder="e.g. Funds cycled back to originator via 3 shell hops"
                              value={hypothesisForm.title}
                              onChange={(e) => setHypothesisForm({ ...hypothesisForm, title: e.target.value })}
                              style={{ background: '#121215', borderColor: '#27272a', color: '#fff' }}
                              className="mb-2"
                              required
                            />
                            <Button type="submit" size="sm" variant="outline-primary" className="py-1">
                              + Add Hypothesis
                            </Button>
                          </Form>

                          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                            {intel.hypotheses?.map((h) => (
                              <div key={h.id} className="p-2 mb-2 rounded-2" style={{ background: '#121215', border: '1px solid #27272a' }}>
                                <div className="d-flex justify-content-between align-items-center">
                                  <strong className="text-white small">{h.title}</strong>
                                  <Badge bg={h.status === 'SUPPORTED' ? 'success' : h.status === 'REJECTED' ? 'danger' : 'secondary'}>
                                    {h.status}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </div>
              )}
            </>
          ) : null}
        </Modal.Body>

        <Modal.Footer className="border-secondary border-opacity-25 bg-black py-2 px-4">
          <Button variant="secondary" size="sm" onClick={onHide}>
            Close Case Report
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Quick Entity Note Modal */}
      <Modal
        show={!!noteModalTarget}
        onHide={() => setNoteModalTarget(null)}
        centered
        contentClassName="bg-black text-light border border-secondary border-opacity-50"
      >
        <Modal.Header closeButton closeVariant="white" className="border-secondary border-opacity-25">
          <Modal.Title className="fs-6 fw-bold">
            Add Forensic Note for {noteModalTarget?.type}: {noteModalTarget?.id}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSaveEntityNote}>
          <Modal.Body className="p-3">
            <Form.Group>
              <Form.Label className="small text-muted">Investigator Observation / Evidence</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                placeholder="Log transaction verification results, counterparty analysis, or customer interview notes..."
                value={entityNoteText}
                onChange={(e) => setEntityNoteText(e.target.value)}
                style={{ background: '#121215', borderColor: '#27272a', color: '#fff', fontSize: '13px' }}
                required
                autoFocus
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="border-secondary border-opacity-25 py-2">
            <Button variant="secondary" size="sm" onClick={() => setNoteModalTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={savingEntityNote}>
              {savingEntityNote ? 'Saving...' : 'Save Note'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Assignment Modal (Admin only) */}
      <Modal
        show={showAssignModal}
        onHide={() => setShowAssignModal(false)}
        centered
        contentClassName="bg-black text-light border border-secondary border-opacity-50"
      >
        <Modal.Header closeButton closeVariant="white" className="border-secondary border-opacity-25">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
            <Users size={18} className="text-primary" /> Assign Investigation Case #{caseId}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleExecuteAssign}>
          <Modal.Body className="p-3">
            <Form.Group className="mb-3">
              <Form.Label className="small text-muted">Select Investigator / Analyst</Form.Label>
              <Form.Select
                value={selectedAssigneeId}
                onChange={(e) => setSelectedAssigneeId(e.target.value)}
                style={{ background: '#121215', borderColor: '#27272a', color: '#fff', fontSize: '13px' }}
                required
              >
                <option value="">-- Choose Staff Member --</option>
                {staffUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.role}) - {u.email}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label className="small text-muted">Assignment Instructions / Scope</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Specific instructions, high-priority mule clusters to triage, deadline notes..."
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                style={{ background: '#121215', borderColor: '#27272a', color: '#fff', fontSize: '13px' }}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="border-secondary border-opacity-25 py-2">
            <Button variant="secondary" size="sm" onClick={() => setShowAssignModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isAssigning || !selectedAssigneeId}>
              {isAssigning ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Transition & Self-Approval Modal */}
      <Modal
        show={showTransitionModal}
        onHide={() => setShowTransitionModal(false)}
        centered
        contentClassName="bg-black text-light border border-secondary border-opacity-50"
      >
        <Modal.Header closeButton closeVariant="white" className="border-secondary border-opacity-25">
          <Modal.Title className="fs-6 fw-bold">
            Transition Case to {(pendingTargetStatus || '').replace(/_/g, ' ')}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleExecuteTransition}>
          <Modal.Body className="p-3">
            <div className="p-3 rounded-2 mb-3" style={{ background: 'rgba(210,153,34,0.12)', border: '1px solid rgba(210,153,34,0.3)' }}>
              <div className="d-flex align-items-center gap-2 text-warning fw-bold small mb-1">
                <AlertTriangle size={15} /> Strict One-Way Progression Policy
              </div>
              <p className="text-light small mb-0" style={{ fontSize: '12px', lineHeight: 1.4 }}>
                You are about to advance this case from <strong className="text-info">{(caseObj?.status || 'OPEN').replace(/_/g, ' ')}</strong> to <strong className="text-success">{(pendingTargetStatus || '').replace(/_/g, ' ')}</strong>. Under compliance rules, this stage transition is <strong>permanent and cannot be reversed</strong>.
              </p>
            </div>

            <Form.Group className="mb-3">
              <Form.Label className="small text-muted">Transition Audit Notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Reason for transition, findings summary, or regulatory context..."
                value={transitionNotes}
                onChange={(e) => setTransitionNotes(e.target.value)}
                style={{ background: '#121215', borderColor: '#27272a', color: '#fff', fontSize: '13px' }}
              />
            </Form.Group>

            {/* Separation of Duties Exception (if Admin closing/approving their own investigation) */}
            {isAdmin && (pendingTargetStatus === 'APPROVED' || pendingTargetStatus === 'CLOSED') && isAssigned && (
              <div className="p-3 rounded-2 bg-warning bg-opacity-10 border border-warning border-opacity-30 mb-2">
                <div className="d-flex align-items-center gap-2 text-warning fw-bold small mb-2">
                  <AlertTriangle size={16} /> Separation of Duties Exception Required
                </div>
                <p className="text-muted small mb-2" style={{ fontSize: '12px' }}>
                  You participated in this investigation. Approving or closing your own case requires recording an explicit self-approval exception for audit compliance.
                </p>
                <Form.Check
                  type="checkbox"
                  id="self-approval-check"
                  label={<span className="small text-white fw-semibold">Authorize Self-Approval Exception</span>}
                  checked={selfApprovalException}
                  onChange={(e) => setSelfApprovalException(e.target.checked)}
                  className="mb-2"
                  required
                />
                {selfApprovalException && (
                  <Form.Control
                    size="sm"
                    type="text"
                    placeholder="Provide compliance justification for self-approval..."
                    value={selfApprovalReason}
                    onChange={(e) => setSelfApprovalReason(e.target.value)}
                    style={{ background: '#121215', borderColor: '#27272a', color: '#fff', fontSize: '12px' }}
                    required
                  />
                )}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className="border-secondary border-opacity-25 py-2">
            <Button variant="secondary" size="sm" onClick={() => setShowTransitionModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isTransitioning}>
              {isTransitioning ? 'Updating...' : `Confirm ${(pendingTargetStatus || '').replace(/_/g, ' ')}`}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Report Release Modal (Admin only) */}
      <Modal
        show={showReleaseModal}
        onHide={() => setShowReleaseModal(false)}
        centered
        contentClassName="bg-black text-light border border-secondary border-opacity-50"
      >
        <Modal.Header closeButton closeVariant="white" className="border-secondary border-opacity-25">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
            <Send size={18} className="text-success" /> Release Official Investigation Report
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleReleaseReport}>
          <Modal.Body className="p-3">
            <p className="text-muted small mb-3">
              Releasing this report grants authorized Client Organization users access to view and download the official versioned PDF investigation package in their portal.
            </p>

            {(caseObj?.is_synthetic || caseObj?.case_origin === 'LIVESHIELD_SIMULATION') && (
              <Alert variant="danger" className="py-2 px-3 bg-danger bg-opacity-10 border-danger border-opacity-30 text-danger small mb-3">
                <ShieldAlert size={14} className="me-1" /> This is a <strong>Synthetic Simulation Case</strong>. Released report will be permanently watermarked: <em>"TEST / SYNTHETIC SIMULATION — NOT FOR REGULATORY FILING"</em>.
              </Alert>
            )}

            <div className="p-2.5 rounded-2 mb-3" style={{ background: '#161b22', border: '1px solid #30363d' }}>
              <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', fontWeight: 600, marginBottom: '2px' }}>
                Target Recipient
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#58a6ff' }}>
                Auto-targeted to Requesting Client Organization #{caseObj?.organization_id || 1}
              </div>
            </div>

            <Form.Group>
              <Form.Label className="small text-muted">Release Notes / Cover Summary</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Final conclusion summary for client executive review..."
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                style={{ background: '#121215', borderColor: '#27272a', color: '#fff', fontSize: '13px' }}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="border-secondary border-opacity-25 py-2">
            <Button variant="secondary" size="sm" onClick={() => setShowReleaseModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="success" size="sm" disabled={isReleasing}>
              {isReleasing ? 'Releasing...' : 'Confirm Release to Client'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Alert One-Way Triage Confirmation Modal */}
      {alertConfirmTarget && (
        <Modal
          show={!!alertConfirmTarget}
          onHide={() => setAlertConfirmTarget(null)}
          centered
          contentClassName="bg-black text-light border border-secondary border-opacity-50"
        >
          <Modal.Header closeButton closeVariant="white" className="border-secondary border-opacity-25">
            <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
              {alertConfirmTarget.action === 'CONFIRM_FRAUD' ? (
                <ShieldAlert size={18} className="text-danger" />
              ) : alertConfirmTarget.action === 'DISMISS' ? (
                <CheckCircle size={18} className="text-success" />
              ) : (
                <AlertTriangle size={18} className="text-warning" />
              )}
              Confirm Alert #{alertConfirmTarget.alertId} Determination
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-3">
            <p className="small text-white mb-2">
              Are you sure you want to {alertConfirmTarget.action === 'CONFIRM_FRAUD' ? (
                <strong className="text-danger">APPROVE FRAUD</strong>
              ) : alertConfirmTarget.action === 'DISMISS' ? (
                <strong className="text-success">MARK AS LEGITIMATE / FALSE POSITIVE</strong>
              ) : (
                <strong className="text-warning">ESCALATE TO SAR</strong>
              )} for <strong>Alert #{alertConfirmTarget.alertId} ({alertConfirmTarget.patternName})</strong>?
            </p>

            <div className="p-2.5 rounded-2 mb-3" style={{ background: 'rgba(210,153,34,0.1)', border: '1px solid rgba(210,153,34,0.3)', fontSize: '12px', color: '#d29922' }}>
              ⚠️ <strong>Strict One-Way Workflow:</strong> Once confirmed, this alert will be classified and permanently cleared from the pending triage queue. It cannot be reverted.
            </div>

            <Form.Group>
              <Form.Label className="small text-muted">Investigator Rationale / Notes (Optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Log observation notes, structuring rationale, or legitimization evidence..."
                value={alertConfirmNotes}
                onChange={(e) => setAlertConfirmNotes(e.target.value)}
                style={{ background: '#121215', borderColor: '#27272a', color: '#fff', fontSize: '13px' }}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="border-secondary border-opacity-25 py-2">
            <Button variant="secondary" size="sm" onClick={() => setAlertConfirmTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={alertConfirmTarget.action === 'CONFIRM_FRAUD' ? 'danger' : alertConfirmTarget.action === 'DISMISS' ? 'success' : 'warning'}
              size="sm"
              disabled={alertActionLoading[alertConfirmTarget.alertId]}
              onClick={() => handleAlertDecision(alertConfirmTarget.alertId, alertConfirmTarget.action, alertConfirmNotes || `Investigator executed ${alertConfirmTarget.action}`)}
            >
              {alertActionLoading[alertConfirmTarget.alertId] ? 'Saving...' : 'Confirm Determination →'}
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {/* Account Drilldown Popup Modal */}
      <AccountDrilldownModal
        show={!!selectedAccountId}
        onHide={() => setSelectedAccountId(null)}
        accountId={selectedAccountId}
        caseId={caseId}
        onAccountUpdated={loadIntelligence}
        allAccountsMap={accountsMap}
      />
    </>
  );
}
