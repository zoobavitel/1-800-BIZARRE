import React, { useState, useEffect, useCallback } from 'react';
import { campaignAPI } from '../features/character-sheet';

const S = {
  page:  { fontFamily: 'monospace', fontSize: '13px', background: '#000', color: '#fff', minHeight: '100vh' },
  content: { padding: '16px', maxWidth: '1000px', margin: '0 auto' },
  card: { background: '#111827', border: '1px solid #374151', borderRadius: '4px', padding: '16px', marginBottom: '12px' },
  lbl: { color: '#f87171', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', display: 'block' },
  inp: {
    background: 'transparent', color: '#fff', border: 'none', borderBottom: '1px solid #4b5563',
    padding: '4px 6px', width: '100%', fontFamily: 'monospace', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  },
  btn: { padding: '6px 14px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', border: 'none', fontFamily: 'monospace' },
  emptyState: { textAlign: 'center', padding: '48px 16px', color: '#6b7280' },
};

export default function CampaignManagement() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await campaignAPI.getCampaigns();
      setCampaigns(list || []);
    } catch (err) {
      setError(err.message || 'Failed to load campaigns');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const startCreate = () => {
    setEditing('new');
    setForm({ name: '', description: '' });
  };

  const startEdit = (campaign) => {
    setEditing(campaign.id);
    setForm({ name: campaign.name || '', description: campaign.description || '' });
  };

  const cancelEdit = () => { setEditing(null); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      if (editing === 'new') {
        await campaignAPI.createCampaign(form);
      } else {
        await campaignAPI.updateCampaign(editing, form);
      }
      setEditing(null);
      await loadCampaigns();
    } catch (err) {
      setError(err.message || 'Save failed');
    }
  };

  return (
    <div style={S.page}>
      <div style={S.content}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
          <button onClick={startCreate} style={{ ...S.btn, background: '#16a34a', color: '#fff' }}>+ New Campaign</button>
        </div>
        {error && (
          <div style={{ background: '#7f1d1d', border: '1px solid #b91c1c', borderRadius: '4px', padding: '8px 12px', fontSize: '12px', color: '#fca5a5', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        {editing != null && (
          <div style={{ ...S.card, border: '1px solid #7c3aed' }}>
            <span style={S.lbl}>{editing === 'new' ? 'CREATE CAMPAIGN' : 'EDIT CAMPAIGN'}</span>
            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Name</span>
              <input
                style={S.inp}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Campaign name"
                autoFocus
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Description</span>
              <textarea
                style={{ ...S.inp, height: '60px', resize: 'vertical', border: '1px solid #374151', background: '#0d1117', padding: '6px' }}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSave} style={{ ...S.btn, background: '#7c3aed', color: '#fff' }}>Save</button>
              <button onClick={cancelEdit} style={{ ...S.btn, background: '#374151', color: '#9ca3af' }}>Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={S.emptyState}>Loading campaigns…</div>
        ) : campaigns.length === 0 ? (
          <div style={S.emptyState}>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>No campaigns yet</div>
            <div style={{ fontSize: '12px', marginBottom: '16px' }}>Create one to start organizing your sessions, NPCs, and factions.</div>
            <button onClick={startCreate} style={{ ...S.btn, background: '#7c3aed', color: '#fff', fontSize: '13px' }}>
              + Create Your First Campaign
            </button>
          </div>
        ) : (
          campaigns.map((c) => (
            <div key={c.id} style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{c.name || 'Unnamed Campaign'}</div>
                  {c.description && <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>{c.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => startEdit(c)} style={{ ...S.btn, background: '#374151', color: '#d1d5db' }}>Edit</button>
                </div>
              </div>
              {c.created_at && (
                <div style={{ fontSize: '10px', color: '#4b5563', marginTop: '8px' }}>
                  Created {new Date(c.created_at).toLocaleDateString()}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
