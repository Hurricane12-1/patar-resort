import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import '../styles/resort-department.css';
import { api } from '../lib/api.ts';
import { fmtTime } from '../lib/format.ts';
import { toast } from '../components/Toasts.tsx';
import { useReveal } from '../hooks/useReveal.ts';
import {
  canUseRoomReadiness,
  formatDepartmentBadge,
  getAllowedOperationalDepartments,
  isAdministrator,
  OperationalDepartmentId,
} from '../lib/rbac.ts';

export default function ResortDepartment() {
  const { session, adminSession, profile, adminProfile, setAuthOpen } = useAuth();
  const currentSession = adminSession || session;
  const activeProfile = adminProfile || profile;
  const isExecAdmin = isAdministrator(activeProfile);
  const allowedDepts = getAllowedOperationalDepartments(activeProfile);
  const allowRoomReadiness = canUseRoomReadiness(activeProfile);
  const visibleDepts = isExecAdmin
    ? [{ id: 'all', label: 'All Operations' }, ...allowedDepts]
    : allowedDepts;
  const defaultDeptId = allowedDepts[0]?.id || 'housekeeping';

  const [activeDept, setActiveDept] = useState(isExecAdmin ? 'all' : defaultDeptId);
  const [tasks, setTasks] = useState<any[]>([]);
  const [roomsStatus, setRoomsStatus] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({ department: defaultDeptId, title: '', room_name: '', priority: 'normal', assigned_to: '' });
  const [subTab, setSubTab] = useState<'tasks' | 'inventory' | 'rooms'>('tasks');
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  useEffect(() => {
    if (!isExecAdmin && activeDept !== defaultDeptId && !allowedDepts.some((d) => d.id === activeDept)) {
      setActiveDept(defaultDeptId);
    }
    setNewTask((prev) => ({
      ...prev,
      department: allowedDepts.some((d) => d.id === prev.department) ? prev.department : defaultDeptId,
    }));
  }, [isExecAdmin, defaultDeptId]);

  useEffect(() => {
    if (!currentSession) { setLoading(false); return; }
    let live = true;
    Promise.all([
      api.departmentTasks(),
      allowRoomReadiness ? api.departmentRoomStatus().catch(() => []) : Promise.resolve([]),
      api.departmentInventory(),
    ])
      .then(([t, r, inv]) => {
        if (!live) return;
        setTasks(Array.isArray(t) ? t : []);
        setRoomsStatus(Array.isArray(r) ? r : []);
        setInventory(Array.isArray(inv) ? inv : []);
      })
      .catch((e) => toast(e.message, true))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [currentSession, allowRoomReadiness]);

  useReveal(!loading);

  if (!currentSession) {
    return (
      <div className="staff-denied-container">
        <div className="staff-denied-card">
          <div className="staff-denied-icon">
            <i className="fas fa-lock" />
          </div>
          <span className="label" style={{ color: '#FB7185' }}>Staff Authentication Required</span>
          <h2 className="serif" style={{ fontSize: '1.8rem', margin: '8px 0 12px', color: '#FFFFFF' }}>
            Operational Dispatch Portal
          </h2>
          <p className="muted" style={{ margin: '0 0 24px', fontSize: '.88rem' }}>
            Sign in with active employee credentials to access department tasks, room turnaround, and inventory ledgers.
          </p>
          <Link to="/staff/login" className="btn btn-sky" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px' }}>
            <i className="fas fa-right-to-bracket" />
            <span>Go to Staff Station Sign In</span>
          </Link>
        </div>
      </div>
    );
  }

  const filteredTasks = tasks.filter((t) => {
    const matchesDept = activeDept === 'all' || t.department === activeDept;
    const matchesStatus = taskFilter === 'all' || t.status === taskFilter;
    return matchesDept && matchesStatus;
  });

  const filteredInv = inventory.filter((i) => activeDept === 'all' || i.category === activeDept);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    try {
      const created = await api.createDepartmentTask(newTask);
      setTasks((x) => [created, ...x]);
      toast('Operational task dispatched successfully ✦');
      setShowTaskModal(false);
      setNewTask({ department: defaultDeptId, title: '', room_name: '', priority: 'normal', assigned_to: '' });
    } catch (err: any) {
      toast(err.message || 'Failed to dispatch task', true);
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await api.updateDepartmentTaskStatus(id, status);
      setTasks((x) => x.map((t) => (t.id === id ? { ...t, status } : t)));
      toast(`Task status updated to ${status.replace('_', ' ').toUpperCase()}`);
    } catch (err: any) {
      toast(err.message || 'Failed to update task status', true);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px 60px' }}>
      {/* Page Header */}
      <div className="sec-head reveal">
        <div>
          <span className="label">
            <i className="fas fa-layer-group" /> {formatDepartmentBadge(activeProfile)} Operations Console
          </span>
          <h2 className="serif" style={{ fontSize: 'clamp(2rem, 3.8vw, 3.2rem)' }}>
            Operational <em style={{ fontStyle: 'italic', color: '#38BDF8' }}>Department Dispatch</em>
          </h2>
        </div>
        {allowedDepts.length > 0 && (
          <button
            type="button"
            className="btn btn-sky"
            onClick={() => setShowTaskModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <i className="fas fa-plus" />
            <span>Dispatch New Task</span>
          </button>
        )}
      </div>

      {/* DEPARTMENT TABS */}
      <div className="chip-row reveal" style={{ marginBottom: 20 }}>
        {visibleDepts.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`chip ${activeDept === d.id ? 'sel' : ''}`}
            onClick={() => setActiveDept(d.id)}
          >
            <span>{d.label}</span>
          </button>
        ))}
      </div>

      {/* SUB-TABS (TASK QUEUE / INVENTORY / ROOM READINESS) */}
      <div className="modal-tabs reveal" style={{ maxWidth: 480, marginBottom: 28 }}>
        <button
          type="button"
          className={subTab === 'tasks' ? 'sel' : ''}
          onClick={() => setSubTab('tasks')}
        >
          <i className="fas fa-list-check" style={{ marginRight: 6 }} />
          Task Queue ({filteredTasks.length})
        </button>
        <button
          type="button"
          className={subTab === 'inventory' ? 'sel' : ''}
          onClick={() => setSubTab('inventory')}
        >
          <i className="fas fa-boxes-stacked" style={{ marginRight: 6 }} />
          Stock Inventory ({filteredInv.length})
        </button>
        {allowRoomReadiness && (
          <button
            type="button"
            className={subTab === 'rooms' ? 'sel' : ''}
            onClick={() => setSubTab('rooms')}
          >
            <i className="fas fa-bed" style={{ marginRight: 6 }} />
            Room Readiness ({roomsStatus.length})
          </button>
        )}
      </div>

      {/* OVERVIEW STATS */}
      <div className="stat-cards reveal" style={{ marginBottom: 32 }}>
        <div className="stat-card">
          <small>Active Tasks</small>
          <b>{filteredTasks.filter((t) => t.status !== 'completed').length} pending</b>
        </div>
        {allowRoomReadiness && (
          <div className="stat-card">
            <small>Housekeeping Ready</small>
            <b>{roomsStatus.filter((r) => r.housekeeping_status === 'clean_ready').length} units</b>
          </div>
        )}
        <div className="stat-card">
          <small>Priority Escalations</small>
          <b>{filteredTasks.filter((t) => t.priority === 'high' || t.priority === 'urgent').length} urgent</b>
        </div>
        <div className="stat-card">
          <small>Supplies Tracked</small>
          <b>{filteredInv.length} line items</b>
        </div>
      </div>

      {/* SUB-TAB 1: TASKS QUEUE */}
      {subTab === 'tasks' && (
        <div className="panel reveal">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
            <div>
              <h3 className="serif" style={{ fontSize: '1.45rem', margin: 0 }}>
                Live Department Task Queue
              </h3>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: '.82rem' }}>
                Operational work items dispatched across housekeeping, maintenance, and concierge teams.
              </p>
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className={`chip ${taskFilter === 'all' ? 'sel' : ''}`}
                onClick={() => setTaskFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`chip ${taskFilter === 'pending' ? 'sel' : ''}`}
                onClick={() => setTaskFilter('pending')}
              >
                Pending
              </button>
              <button
                type="button"
                className={`chip ${taskFilter === 'in_progress' ? 'sel' : ''}`}
                onClick={() => setTaskFilter('in_progress')}
              >
                In Progress
              </button>
              <button
                type="button"
                className={`chip ${taskFilter === 'completed' ? 'sel' : ''}`}
                onClick={() => setTaskFilter('completed')}
              >
                Completed
              </button>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748B' }}>
              <i className="fas fa-clipboard-check" style={{ fontSize: '2.4rem', opacity: 0.4, marginBottom: 12, display: 'block' }} />
              <p style={{ margin: 0, fontSize: '.9rem' }}>No operational tasks found for this department filter.</p>
            </div>
          ) : (
            filteredTasks.map((t) => (
              <div key={t.id} className="bk-row">
                <div className="bk-main">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                    <span className="pill pending" style={{ textTransform: 'uppercase', fontSize: '.64rem' }}>
                      {t.department?.replace('_', ' ')}
                    </span>
                    {t.room_name && (
                      <span className="tag" style={{ margin: 0, background: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38BDF8' }}>
                        <i className="fas fa-door-open" style={{ marginRight: 4, fontSize: '.65rem' }} />
                        {t.room_name}
                      </span>
                    )}
                    {t.priority === 'urgent' && (
                      <span className="pill urgent">
                        <i className="fas fa-bolt" style={{ marginRight: 4 }} /> URGENT
                      </span>
                    )}
                    {t.priority === 'high' && (
                      <span className="pill cancelled">HIGH PRIORITY</span>
                    )}
                  </div>
                  <h4 style={{ fontSize: '1.05rem', margin: '0 0 6px', color: '#FFFFFF' }}>{t.title}</h4>
                  <p className="muted" style={{ fontSize: '.78rem', margin: 0 }}>
                    Assigned: <strong style={{ color: '#E2E8F0' }}>{t.assigned_to || 'Unassigned Staff'}</strong> · Logged {fmtTime(t.created_at)}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={`pill ${t.status === 'completed' ? 'delivered' : t.status === 'in_progress' ? 'sent' : 'pending'}`}>
                    {t.status?.replace('_', ' ')}
                  </span>
                  <div>
                    {t.status === 'pending' && (
                      <button
                        type="button"
                        className="act-btn"
                        onClick={() => updateStatus(t.id, 'in_progress')}
                        style={{ background: 'rgba(14, 165, 233, 0.2)', borderColor: 'rgba(56, 189, 248, 0.45)', color: '#38BDF8' }}
                      >
                        <i className="fas fa-play" style={{ fontSize: '.68rem' }} /> Start
                      </button>
                    )}
                    {t.status === 'in_progress' && (
                      <button
                        type="button"
                        className="act-btn"
                        onClick={() => updateStatus(t.id, 'completed')}
                        style={{ background: 'rgba(16, 185, 129, 0.2)', borderColor: 'rgba(52, 211, 153, 0.45)', color: '#34D399' }}
                      >
                        <i className="fas fa-check" style={{ fontSize: '.68rem' }} /> Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* SUB-TAB 2: INVENTORY STOCK */}
      {subTab === 'inventory' && (
        <div className="panel reveal">
          <h3 className="serif" style={{ fontSize: '1.45rem', margin: '0 0 4px' }}>
            Department Stock Supplies &amp; Linens
          </h3>
          <p className="muted" style={{ margin: '0 0 18px', fontSize: '.82rem' }}>
            Live material counts and automatic low-stock replenishment thresholds.
          </p>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Item Description</th>
                  <th>Category</th>
                  <th>Stock Quantity</th>
                  <th>Reorder Level</th>
                  <th>Inventory Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredInv.map((item) => (
                  <tr key={item.id}>
                    <td><b style={{ color: '#FFFFFF' }}>{item.item_name}</b></td>
                    <td><span className="tag" style={{ margin: 0 }}>{item.category}</span></td>
                    <td><b style={{ color: '#38BDF8' }}>{item.stock_qty} {item.unit}</b></td>
                    <td style={{ color: '#64748B' }}>{item.reorder_at} {item.unit}</td>
                    <td>
                      <span className={`pill ${item.stock_qty <= item.reorder_at ? 'cancelled' : 'delivered'}`}>
                        {item.stock_qty <= item.reorder_at ? 'Low Stock Warning' : 'Optimal'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: ROOM READINESS */}
      {allowRoomReadiness && subTab === 'rooms' && (
        <div className="panel reveal">
          <h3 className="serif" style={{ fontSize: '1.45rem', margin: '0 0 4px' }}>
            Housekeeping &amp; Room Readiness Ledger
          </h3>
          <p className="muted" style={{ margin: '0 0 18px', fontSize: '.82rem' }}>
            Sanitation turnaround status and real-time room readiness for front desk check-in.
          </p>

          {roomsStatus.map((r) => (
            <div key={r.id} className="room-readiness-row">
              <div>
                <b style={{ fontSize: '1.05rem', color: '#FFFFFF' }}>{r.name}</b>
                <div style={{ marginTop: 4 }}>
                  <span className="tag" style={{ margin: '0 8px 0 0' }}>{r.category}</span>
                  <span className="muted small">
                    <i className="fas fa-users" style={{ marginRight: 4 }} />
                    {r.occupied_units} / {r.units} occupied
                  </span>
                </div>
              </div>
              <span className={`pill ${r.housekeeping_status === 'clean_ready' ? 'delivered' : 'pending'}`}>
                <i className={`fas ${r.housekeeping_status === 'clean_ready' ? 'fa-circle-check' : 'fa-broom'}`} style={{ marginRight: 5 }} />
                {r.housekeeping_status === 'clean_ready' ? 'Clean & Ready' : 'Turn-down Needed'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* TASK DISPATCH MODAL */}
      {showTaskModal && (
        <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Dispatch Department Task</h3>
              <p>Assign operational work order to resort staff.</p>
            </div>
            <form className="modal-body" onSubmit={createTask}>
              <div className="field">
                <label>OPERATIONAL DEPARTMENT</label>
                <select
                  value={newTask.department}
                  onChange={(e) => setNewTask({ ...newTask, department: e.target.value as OperationalDepartmentId })}
                >
                  {allowedDepts.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>TASK WORK ORDER TITLE</label>
                <input
                  required
                  value={newTask.title}
                  placeholder="e.g. Turn-down service, extra towels, pool pump check"
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                />
              </div>
              <div className="field">
                <label>ACCOMMODATION / ROOM NAME (OPTIONAL)</label>
                <input
                  value={newTask.room_name}
                  placeholder="e.g. Habagat Sea-View Suite"
                  onChange={(e) => setNewTask({ ...newTask, room_name: e.target.value })}
                />
              </div>
              <div className="field">
                <label>ASSIGN EMPLOYEE / LEAD (OPTIONAL)</label>
                <input
                  value={newTask.assigned_to}
                  placeholder="e.g. Housekeeping Lead or Kitchen Staff"
                  onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                />
              </div>
              <div className="field">
                <label>PRIORITY LEVEL</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                >
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent Escalation</option>
                </select>
              </div>
              <button
                type="submit"
                className="btn btn-sky"
                style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
              >
                Dispatch Task to Queue
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
