'use client';

import React, { useState } from 'react';

interface Task {
  id: string;
  title: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  type: 'gst' | 'itr' | 'audit' | 'pf';
}

interface Staff {
  id: string;
  name: string;
  role: string;
}

interface TaskDetailsModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (taskId: string) => void;
  onReschedule?: (taskId: string, date: string) => void;
  onAssign?: (taskId: string, staffId: string) => void;
  staffList: Staff[];
}

export default function TaskDetailsModal({
  task,
  isOpen,
  onClose,
  onComplete,
  onReschedule,
  onAssign,
  staffList,
}: TaskDetailsModalProps) {
  const [comments, setComments] = useState<string[]>([
    'Awaiting client bank statements to reconcile purchase reports.',
    'Followed up with client accountant via WhatsApp nudge.',
  ]);
  const [newComment, setNewComment] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newDate, setNewDate] = useState('');

  if (!isOpen || !task) return null;

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    setComments([...comments, newComment.trim()]);
    setNewComment('');
  };

  const getPriorityBadgeColor = (p: string) => {
    switch (p) {
      case 'high': return 'var(--danger)';
      case 'medium': return 'var(--warning)';
      case 'low': return 'var(--success)';
      default: return 'var(--text-muted)';
    }
  };

  // Simulated task attachments
  const mockAttachments = [
    { name: 'gstr3b_summary_sheet.xlsx', size: '42 KB', type: 'excel' },
    { name: 'challan_payment_receipt_may26.pdf', size: '1.2 MB', type: 'pdf' },
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 1001,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(27, 58, 107, 0.4)',
      backdropFilter: 'blur(4px)',
    }}>
      <div className="card" style={{
        width: '560px',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative',
        padding: '24px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
        background: 'var(--bg-white)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span className="badge" style={{
              background: `var(--${task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'success'}-light)`,
              color: getPriorityBadgeColor(task.priority),
              fontWeight: 700,
              fontSize: '11px',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}>
              {task.priority} Priority
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary)', marginTop: '4px' }}>{task.title}</h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Task ID: #{task.id}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Task Properties */}
        <div className="grid g2" style={{ background: 'var(--bg-gray)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>DUE DATE</div>
            <div style={{ fontWeight: '700', color: task.completed ? 'var(--text-secondary)' : 'var(--danger)' }}>
              📅 {task.dueDate} {task.completed && '(Completed)'}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>ASSIGNED TO</div>
            <select
              defaultValue=""
              onChange={(e) => onAssign && onAssign(task.id, e.target.value)}
              style={{
                width: '100%',
                padding: '6px',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '12.5px',
                background: 'var(--bg-white)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">Unassigned</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Task Description */}
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>Task Description</h4>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Verify client ledger entries against GSTR-2B details, resolve discrepancies larger than ₹1,000, draft reconciliation files, and upload payment challans for approval.
          </p>
        </div>

        {/* Attachments */}
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>📎 Attachments (2)</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {mockAttachments.map((att, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-white)', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{att.type === 'pdf' ? '📄' : '📊'}</span>
                  <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{att.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({att.size})</span>
                </div>
                <button
                  onClick={() => alert(`Downloading ${att.name}...`)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '700',
                  }}
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Comments Section */}
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>💬 Discussion & Notes</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '120px', overflowY: 'auto', marginBottom: '10px', paddingRight: '4px' }}>
            {comments.map((comment, idx) => (
              <div key={idx} style={{ padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-gray)', fontSize: '12.5px', borderLeft: '3px solid var(--primary)' }}>
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.4' }}>{comment}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>10:35 AM • Staff Clerk</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Add internal clerk note..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '12.5px',
                outline: 'none',
              }}
            />
            <button onClick={handleAddComment} className="btn btn-secondary btn-sm" style={{ padding: '8px 14px' }}>
              Add
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '4px' }}>
          <div>
            {!task.completed ? (
              <button
                onClick={() => {
                  onComplete(task.id);
                  onClose();
                }}
                className="btn btn-primary"
                style={{ background: 'var(--success)', borderColor: 'var(--success)', fontWeight: '700' }}
              >
                ✓ Complete Task
              </button>
            ) : (
              <span className="badge badge-success" style={{ padding: '8px 14px', fontSize: '12px' }}>✓ Completed</span>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setIsRescheduling(!isRescheduling)}
              className="btn btn-secondary btn-sm"
            >
              📅 Reschedule
            </button>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this task?')) {
                  alert('Task deleted successfully');
                  onClose();
                }
              }}
              className="btn btn-secondary btn-sm"
              style={{ color: 'var(--danger)' }}
            >
              🗑️ Delete
            </button>
          </div>
        </div>

        {/* Reschedule Datepicker */}
        {isRescheduling && (
          <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-gray)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 10px',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '12.5px',
              }}
            />
            <button
              onClick={() => {
                if (newDate && onReschedule) {
                  onReschedule(task.id, newDate);
                  setIsRescheduling(false);
                  alert(`Task rescheduled to ${newDate}`);
                }
              }}
              className="btn btn-primary btn-sm"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
