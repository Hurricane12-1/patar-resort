import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import '../styles/resort-department.css';
import { api } from '../lib/api.ts';
import { fmtTime } from '../lib/format.ts';
import { toast } from '../components/Toasts.tsx';
import { useReveal } from '../hooks/useReveal.ts';

const DEPTS = [
  { id: 'all', label: 'All Operations' },
  { id: 'front_desk', label: 'Front Desk' },
  { id: 'housekeeping', label: 'Housekeeping' },
  { id: 'kitchen', label: 'Kitchen & Dining' },
  { id: 'tours', label: 'Tours & Island Hopping' },
  { id: 'maintenance', label: 'Maintenance' },
];

export default function ResortDepartment() {
  const { session, setAuthOpen } = useAuth();
  const [activeDept, setActiveDept] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [roomsStatus, setRoomsStatus] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({ department: 'housekeeping', title: '', room_name: '', priority: 'normal', assigned_to: '' });
  const [subTab, setSubTab] = useState('tasks'); // tasks | inventory | rooms

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    let live = true;
    Promise.all([api.departmentTasks(), api.departmentRoomStatus(), api.departmentInventory()])
      .then(([t, r, inv]) => {
        if (!live) return;
        setTasks(t);
        setRoomsStatus(r);
        setInventory(inv);
      })
      .catch((e) => toast(e.message, true))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [session]);

  useReveal(!loading);

  if (!session) return (
    <div className="container">
      <div className="gate">
        <span className="label">Staff Portal</span>
        <h2 className="serif" style={{ fontSize: '2.4rem', margin: '8px 0 12px' }}>Resort Department Operations</h2>
        <p className="muted" style={{ margin: '0 0 24px' }}>Sign in with staff/admin credentials to access house operations & dispatch.</p>
        <button className="btn btn-sky" onClick={() => setAuthOpen(true)}>Sign in</button>
      </div>
    </div>
  );

  const filteredTasks = tasks.filter((t) => activeDept === 'all' || t.department === activeDept);
  const filteredInv = inventory.filter((i) => activeDept === 'all' || i.category === activeDept);

  async function createTask(e) {
    e.preventDefault();
    try {
      const created = await api.createDepartmentTask(newTask);
      setTasks((x) => [created, ...x]);
      toast('Department task dispatched ✦');
      setShowTaskModal(false);
      setNewTask({ department: 'housekeeping', title: '', room_name: '', priority: 'normal', assigned_to: '' });
    } catch (err) { toast(err.message, true); }
  }

  async function updateStatus(id, status) {
    try {
      await api.updateDepartmentTaskStatus(id, status);
      setTasks((x) => x.map((t) => (t.id === id ? { ...t, status } : t)));
      toast(`Task marked as ${status.replace('_', ' ')}`);
    } catch (err) { toast(err.message, true); }
  }

  return (
    <section className="section">
      <div className="container">
        {/* HEAD */}
        <div className="sec-head reveal">
          <div>
            <span className="label">Staff & Operations Hub</span>
            <h2 className="serif" style={{ fontSize: 'clamp(2.2rem,4.4vw,3.6rem)' }}>
              Resort <em style={{ fontStyle: 'italic' }}>Department</em>
            </h2>
          </div>
          <button className="btn btn-sky" onClick={() => setShowTaskModal(true)}>+ Dispatch Task</button>
        </div>

        {/* DEPARTMENT TABS */}
        <div className="chip-row reveal" style={{ marginBottom: 20 }}>
          {DEPTS.map((d) => (
            <button key={d.id} className={`chip ${activeDept === d.id ? 'sel' : ''}`}
              onClick={() => setActiveDept(d.id)}>{d.label}</button>
          ))}
        </div>

        {/* SUB TABS */}
        <div className="modal-tabs reveal" style={{ maxWidth: 460, marginBottom: 28 }}>
          <button className={subTab === 'tasks' ? 'sel' : ''} onClick={() => setSubTab('tasks')}>Task Queue ({filteredTasks.length})</button>
          <button className={subTab === 'inventory' ? 'sel' : ''} onClick={() => setSubTab('inventory')}>Inventory Stock</button>
          <button className={subTab === 'rooms' ? 'sel' : ''} onClick={() => setSubTab('rooms')}>Room Readiness</button>
        </div>

        {/* OVERVIEW STATS */}
        <div className="stat-cards reveal" style={{ marginBottom: 32 }}>
          <div className="stat-card">
            <small>Active Tasks</small>
            <b>{tasks.filter((t) => t.status !== 'completed').length}</b>
          </div>
          <div className="stat-card">
            <small>Housekeeping Ready</small>
            <b>{roomsStatus.filter((r) => r.housekeeping_status === 'clean_ready').length} rooms</b>
          </div>
          <div className="stat-card">
            <small>High Priority</small>
            <b>{tasks.filter((t) => t.priority === 'high' || t.priority === 'urgent').length}</b>
          </div>
          <div className="stat-card">
            <small>Stock Items Tracked</small>
            <b>{inventory.length} items</b>
          </div>
        </div>

        {/* TASKS VIEW */}
        {subTab === 'tasks' && (
          <div className="panel reveal">
            <h3 className="serif" style={{ fontSize: '1.4rem' }}>Department Task Queue</h3>
            {filteredTasks.length === 0 ? (
              <p className="muted" style={{ padding: '24px 0' }}>No active tasks for this department.</p>
            ) : (
              filteredTasks.map((t) => (
                <div key={t.id} className="bk-row" style={{ alignItems: 'flex-start' }}>
                  <div className="bk-main">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span className="pill pending" style={{ textTransform: 'uppercase', fontSize: '.65rem' }}>{t.department.replace('_', ' ')}</span>
                      {t.room_name && <span className="tag" style={{ margin: 0 }}>{t.room_name}</span>}
                      {t.priority === 'high' && <span className="pill cancelled" style={{ fontSize: '.65rem' }}>HIGH</span>}
                    </div>
                    <h4 style={{ fontSize: '1.05rem' }}>{t.title}</h4>
                    <p className="muted small">Assigned: <b>{t.assigned_to || 'Unassigned'}</b> · {fmtTime(t.created_at)}</p>
                  </div>
                  <span className={`pill ${t.status === 'completed' ? 'delivered' : t.status === 'in_progress' ? 'sent' : 'pending'}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                  <div>
                    {t.status === 'pending' && (
                      <button className="act-btn" onClick={() => updateStatus(t.id, 'in_progress')}>Start</button>
                    )}
                    {t.status === 'in_progress' && (
                      <button className="act-btn" onClick={() => updateStatus(t.id, 'completed')}>Complete</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* INVENTORY VIEW */}
        {subTab === 'inventory' && (
          <div className="panel reveal">
            <h3 className="serif" style={{ fontSize: '1.4rem' }}>Department Inventory & Supplies</h3>
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th>Stock Quantity</th>
                    <th>Reorder Threshold</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInv.map((item) => (
                    <tr key={item.id}>
                      <td><b>{item.item_name}</b></td>
                      <td><span className="tag" style={{ margin: 0 }}>{item.category}</span></td>
                      <td><b>{item.stock_qty} {item.unit}</b></td>
                      <td>{item.reorder_at} {item.unit}</td>
                      <td>
                        <span className={`pill ${item.stock_qty <= item.reorder_at ? 'cancelled' : 'delivered'}`}>
                          {item.stock_qty <= item.reorder_at ? 'Low Stock' : 'Optimal'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ROOM READINESS VIEW */}
        {subTab === 'rooms' && (
          <div className="panel reveal">
            <h3 className="serif" style={{ fontSize: '1.4rem' }}>Housekeeping & Room Readiness Ledger</h3>
            {roomsStatus.map((r) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--sky-mist)' }}>
                <div>
                  <b style={{ fontSize: '1.05rem' }}>{r.name}</b><br />
                  <span className="muted small">{r.category} · {r.occupied_units} / {r.units} occupied</span>
                </div>
                <span className={`pill ${r.housekeeping_status === 'clean_ready' ? 'delivered' : 'pending'}`}>
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
                <p style={{ fontSize: '.85rem', opacity: .85 }}>Assign operational task to resort staff.</p>
              </div>
              <form className="modal-body" onSubmit={createTask}>
                <div className="field">
                  <label>DEPARTMENT</label>
                  <select value={newTask.department} onChange={(e) => setNewTask({ ...newTask, department: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '2px solid var(--line)' }}>
                    <option value="front_desk">Front Desk</option>
                    <option value="housekeeping">Housekeeping</option>
                    <option value="kitchen">Kitchen & Dining</option>
                    <option value="tours">Tours & Island Hopping</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div className="field">
                  <label>TASK TITLE</label>
                  <input required value={newTask.title} placeholder="e.g. Turn-down service, extra towels" onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
                </div>
                <div className="field">
                  <label>ROOM NAME (optional)</label>
                  <input value={newTask.room_name} placeholder="e.g. Habagat Sea-View Suite" onChange={(e) => setNewTask({ ...newTask, room_name: e.target.value })} />
                </div>
                <div className="field">
                  <label>ASSIGN TO (optional)</label>
                  <input value={newTask.assigned_to} placeholder="e.g. Maria (Staff)" onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })} />
                </div>
                <div className="field">
                  <label>PRIORITY</label>
                  <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '2px solid var(--line)' }}>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <button className="btn btn-sky" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>Dispatch Task</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
