import React, { useState, useEffect, useCallback } from 'react';
import { campaignAPI, characterAPI, factionAPI, npcAPI } from '../features/character-sheet';
import { useAuth } from '../features/auth';

const S = {
  page: { fontFamily: 'monospace', fontSize: '13px', background: '#000', color: '#fff', minHeight: '100vh' },
  content: { padding: '16px', maxWidth: '1000px', margin: '0 auto' },
  card: { background: '#111827', border: '1px solid #374151', borderRadius: '4px', padding: '16px', marginBottom: '12px' },
  lbl: { color: '#f87171', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', display: 'block' },
  sectionLbl: { color: '#60a5fa', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', marginTop: '16px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' },
  inp: {
    background: 'transparent', color: '#fff', border: 'none', borderBottom: '1px solid #4b5563',
    padding: '4px 6px', width: '100%', fontFamily: 'monospace', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  },
  select: {
    background: '#0d1117', color: '#fff', border: '1px solid #374151', borderRadius: '4px',
    padding: '4px 6px', fontFamily: 'monospace', fontSize: '13px', outline: 'none',
  },
  btn: { padding: '6px 14px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', border: 'none', fontFamily: 'monospace' },
  btnPrimary: { padding: '6px 14px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', border: 'none', fontFamily: 'monospace', background: '#7c3aed', color: '#fff' },
  btnDanger: { padding: '6px 14px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', border: 'none', fontFamily: 'monospace', background: '#dc2626', color: '#fff' },
  btnGhost: { padding: '6px 14px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', border: 'none', fontFamily: 'monospace', background: '#374151', color: '#d1d5db' },
  btnSuccess: { padding: '6px 14px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', border: 'none', fontFamily: 'monospace', background: '#16a34a', color: '#fff' },
  emptyState: { textAlign: 'center', padding: '48px 16px', color: '#6b7280' },
  badge: { fontSize: '10px', padding: '2px 8px', borderRadius: '9999px', fontWeight: 'bold', display: 'inline-block' },
  divider: { borderTop: '1px solid #1f2937', margin: '12px 0' },
  err: { background: '#7f1d1d', border: '1px solid #b91c1c', borderRadius: '4px', padding: '8px 12px', fontSize: '12px', color: '#fca5a5', marginBottom: '12px' },
  row: { display: 'flex', alignItems: 'center', gap: '8px' },
  tag: { fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' },
};

const PLAYBOOK_LABELS = { STAND: 'Stand User', HAMON: 'Hamon User', SPIN: 'Spin User' };
const PLAYBOOK_COLORS = { STAND: '#a78bfa', HAMON: '#fbbf24', SPIN: '#34d399' };

function PlaybookTag({ playbook }) {
  return (
    <span style={{ ...S.tag, background: PLAYBOOK_COLORS[playbook] || '#4b5563', color: '#000' }}>
      {PLAYBOOK_LABELS[playbook] || playbook}
    </span>
  );
}

function StatusBadge({ active }) {
  return (
    <span style={{ ...S.badge, background: active ? '#064e3b' : '#7f1d1d', color: active ? '#6ee7b7' : '#fca5a5' }}>
      {active ? 'ACTIVE' : 'INACTIVE'}
    </span>
  );
}

function RoleBadge({ role }) {
  return (
    <span style={{ ...S.badge, background: role === 'GM' ? '#7c3aed' : '#1e40af', color: '#fff' }}>
      {role}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Invitation banner shown at the top of the list view
// ---------------------------------------------------------------------------
function PendingInvitations({ invitations, onAccept, onDecline }) {
  if (!invitations.length) return null;
  return (
    <div style={{ ...S.card, border: '1px solid #fbbf24' }}>
      <span style={{ ...S.lbl, color: '#fbbf24' }}>PENDING INVITATIONS</span>
      {invitations.map((inv) => (
        <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1f2937' }}>
          <div>
            <span style={{ fontWeight: 'bold' }}>{inv.campaign_name}</span>
            <span style={{ color: '#9ca3af', fontSize: '11px', marginLeft: '8px' }}>from {inv.invited_by?.username}</span>
          </div>
          <div style={S.row}>
            <button onClick={() => onAccept(inv.id)} style={S.btnSuccess}>Accept</button>
            <button onClick={() => onDecline(inv.id)} style={S.btnGhost}>Decline</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign Detail View
// ---------------------------------------------------------------------------
function CampaignDetail({ campaign, isGM, user, onBack, onRefresh }) {
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteError, setInviteError] = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState(null);
  const [myCharacters, setMyCharacters] = useState([]);
  const [allNPCs, setAllNPCs] = useState([]);
  const [factionForm, setFactionForm] = useState(null);
  const [factionError, setFactionError] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [assignNpcId, setAssignNpcId] = useState('');

  useEffect(() => {
    characterAPI.getCharacters().then(setMyCharacters).catch(() => setMyCharacters([]));
    if (isGM) {
      npcAPI.getNPCs().then(setAllNPCs).catch(() => setAllNPCs([]));
    }
  }, [isGM]);

  const unassignedChars = myCharacters.filter((ch) => !ch.campaign || ch.campaign === campaign.id);
  const myAssigned = (campaign.campaign_characters || []).filter((ch) => ch.user_id === user?.id);
  const availableToAssign = myCharacters.filter((ch) => !ch.campaign && ch.id);
  const unassignedNPCs = allNPCs.filter((n) => !n.campaign || n.campaign === campaign.id);
  const npcsThatCanBeAdded = allNPCs.filter((n) => !n.campaign);

  const handleInvite = async () => {
    setInviteError(null);
    setInviteSuccess(null);
    if (!inviteUsername.trim()) return;
    try {
      await campaignAPI.invitePlayer(campaign.id, inviteUsername.trim());
      setInviteSuccess(`Invitation sent to ${inviteUsername.trim()}`);
      setInviteUsername('');
      onRefresh();
    } catch (err) {
      setInviteError(err.message);
    }
  };

  const handleToggleActive = async () => {
    setActionError(null);
    try {
      if (campaign.is_active) {
        await campaignAPI.deactivateCampaign(campaign.id);
      } else {
        await campaignAPI.activateCampaign(campaign.id);
      }
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleAssignCharacter = async (characterId) => {
    setActionError(null);
    try {
      await campaignAPI.assignCharacter(campaign.id, characterId);
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleUnassignCharacter = async (characterId) => {
    setActionError(null);
    try {
      await campaignAPI.unassignCharacter(campaign.id, characterId);
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleAssignNPC = async () => {
    if (!assignNpcId) return;
    setActionError(null);
    try {
      await npcAPI.patchNPC(assignNpcId, { campaign: campaign.id });
      onRefresh();
      setAssignNpcId('');
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleUnassignNPC = async (npcId) => {
    setActionError(null);
    try {
      await npcAPI.patchNPC(npcId, { campaign: null });
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const startFactionCreate = () => setFactionForm({ name: '', faction_type: '', level: 0, hold: 'weak', reputation: 0, notes: '' });
  const startFactionEdit = (f) => setFactionForm({ id: f.id, name: f.name, faction_type: f.faction_type || '', level: f.level, hold: f.hold, reputation: f.reputation, notes: f.notes || '' });

  const handleFactionSave = async () => {
    setFactionError(null);
    if (!factionForm.name.trim()) { setFactionError('Name is required.'); return; }
    try {
      if (factionForm.id) {
        await factionAPI.updateFaction(factionForm.id, { ...factionForm, campaign: campaign.id });
      } else {
        await factionAPI.createFaction({ ...factionForm, campaign: campaign.id });
      }
      setFactionForm(null);
      onRefresh();
    } catch (err) {
      setFactionError(err.message);
    }
  };

  const handleFactionDelete = async (factionId) => {
    try {
      await factionAPI.deleteFaction(factionId);
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const startCampaignEdit = () => setEditForm({ name: campaign.name, description: campaign.description || '' });

  const handleCampaignEditSave = async () => {
    if (!editForm.name.trim()) return;
    try {
      await campaignAPI.updateCampaign(campaign.id, editForm);
      setEditForm(null);
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <div>
      {/* Back button */}
      <button onClick={onBack} style={{ ...S.btnGhost, marginBottom: '12px' }}>{'< Back to Campaigns'}</button>

      {actionError && <div style={S.err}>{actionError}</div>}

      {/* Header */}
      <div style={{ ...S.card, border: '1px solid #4b5563' }}>
        {editForm ? (
          <>
            <span style={S.lbl}>EDIT CAMPAIGN</span>
            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Name</span>
              <input style={S.inp} value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} autoFocus />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Description</span>
              <textarea
                style={{ ...S.inp, height: '60px', resize: 'vertical', border: '1px solid #374151', background: '#0d1117', padding: '6px' }}
                value={editForm.description}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div style={S.row}>
              <button onClick={handleCampaignEditSave} style={S.btnPrimary}>Save</button>
              <button onClick={() => setEditForm(null)} style={S.btnGhost}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>{campaign.name}</div>
                {campaign.description && <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>{campaign.description}</div>}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <StatusBadge active={campaign.is_active} />
                  <RoleBadge role={isGM ? 'GM' : 'Player'} />
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>
                    GM: {campaign.gm?.username} | Started {campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
              {isGM && (
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button onClick={startCampaignEdit} style={S.btnGhost}>Edit</button>
                  <button onClick={handleToggleActive} style={campaign.is_active ? S.btnDanger : S.btnSuccess}>
                    {campaign.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Players & Characters */}
      <div style={S.card}>
        <span style={S.sectionLbl}>Players &amp; Characters</span>
        {(campaign.campaign_characters || []).length === 0 && (campaign.players || []).length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '12px' }}>No players have joined yet.</div>
        ) : (
          <>
            {/* Show GM */}
            <div style={{ padding: '6px 0', borderBottom: '1px solid #1f2937' }}>
              <div style={S.row}>
                <span style={{ fontWeight: 'bold', color: '#d1d5db' }}>{campaign.gm?.username}</span>
                <RoleBadge role="GM" />
              </div>
            </div>
            {/* Group characters by user */}
            {(() => {
              const playerMap = {};
              (campaign.players || []).forEach((p) => { playerMap[p.id] = { ...p, characters: [] }; });
              (campaign.campaign_characters || []).forEach((ch) => {
                if (!playerMap[ch.user_id]) playerMap[ch.user_id] = { id: ch.user_id, username: ch.username, characters: [] };
                playerMap[ch.user_id].characters.push(ch);
              });
              return Object.values(playerMap)
                .filter((p) => p.id !== campaign.gm?.id)
                .map((p) => (
                  <div key={p.id} style={{ padding: '6px 0', borderBottom: '1px solid #1f2937' }}>
                    <div style={{ ...S.row, marginBottom: '4px' }}>
                      <span style={{ fontWeight: 'bold', color: '#d1d5db' }}>{p.username}</span>
                      <RoleBadge role="Player" />
                    </div>
                    {p.characters.length === 0 ? (
                      <div style={{ fontSize: '11px', color: '#6b7280', paddingLeft: '12px' }}>No character assigned</div>
                    ) : (
                      p.characters.map((ch) => (
                        <div key={ch.id} style={{ paddingLeft: '12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span style={{ color: '#e5e7eb' }}>{ch.true_name || ch.alias || 'Unnamed'}</span>
                          {ch.stand_name && <span style={{ color: '#9ca3af' }}>Stand: {ch.stand_name}</span>}
                          <PlaybookTag playbook={ch.playbook} />
                          {ch.heritage_name && <span style={{ ...S.tag, background: '#374151', color: '#9ca3af' }}>{ch.heritage_name}</span>}
                          {p.id === user?.id && (
                            <button onClick={() => handleUnassignCharacter(ch.id)} style={{ ...S.btn, fontSize: '10px', padding: '2px 6px', background: '#7f1d1d', color: '#fca5a5' }}>Remove</button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                ));
            })()}
          </>
        )}

        {/* Pending invitations (GM view) */}
        {isGM && (campaign.pending_invitations || []).length > 0 && (
          <>
            <div style={{ ...S.divider }} />
            <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 'bold' }}>PENDING INVITATIONS</span>
            {campaign.pending_invitations.map((inv) => (
              <div key={inv.id} style={{ fontSize: '12px', color: '#9ca3af', paddingLeft: '12px', marginTop: '2px' }}>
                {inv.invited_user?.username} (invited by {inv.invited_by?.username})
              </div>
            ))}
          </>
        )}
      </div>

      {/* Invite Player (GM only) */}
      {isGM && (
        <div style={S.card}>
          <span style={S.sectionLbl}>Invite Player</span>
          {inviteError && <div style={{ ...S.err, marginBottom: '8px' }}>{inviteError}</div>}
          {inviteSuccess && <div style={{ background: '#064e3b', border: '1px solid #059669', borderRadius: '4px', padding: '8px 12px', fontSize: '12px', color: '#6ee7b7', marginBottom: '8px' }}>{inviteSuccess}</div>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              style={{ ...S.inp, flex: 1 }}
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              placeholder="Enter username"
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            />
            <button onClick={handleInvite} style={S.btnPrimary}>Invite</button>
          </div>
        </div>
      )}

      {/* Assign Character (Player who is in the campaign) */}
      {!isGM && campaign.players?.some((p) => p.id === user?.id) && availableToAssign.length > 0 && (
        <div style={S.card}>
          <span style={S.sectionLbl}>Assign a Character</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              style={{ ...S.select, flex: 1 }}
              defaultValue=""
              onChange={(e) => e.target.value && handleAssignCharacter(parseInt(e.target.value, 10))}
            >
              <option value="" disabled>Select a character...</option>
              {availableToAssign.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.true_name || ch.alias || `Character #${ch.id}`}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* NPCs (GM only) */}
      {isGM && (
        <div style={S.card}>
          <span style={S.sectionLbl}>Campaign NPCs</span>
          {(campaign.campaign_npcs || []).length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: '12px' }}>No NPCs assigned to this campaign.</div>
          ) : (
            (campaign.campaign_npcs || []).map((npc) => (
              <div key={npc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #1f2937' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <span style={{ color: '#e5e7eb', fontWeight: 'bold' }}>{npc.name}</span>
                  <span style={{ color: '#6b7280' }}>Lv.{npc.level}</span>
                  {npc.stand_name && <span style={{ color: '#9ca3af' }}>Stand: {npc.stand_name}</span>}
                  <PlaybookTag playbook={npc.playbook} />
                  {npc.heritage_name && <span style={{ ...S.tag, background: '#374151', color: '#9ca3af' }}>{npc.heritage_name}</span>}
                </div>
                <button onClick={() => handleUnassignNPC(npc.id)} style={{ ...S.btn, fontSize: '10px', padding: '2px 6px', background: '#374151', color: '#9ca3af' }}>Remove</button>
              </div>
            ))
          )}
          {npcsThatCanBeAdded.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
              <select style={{ ...S.select, flex: 1 }} value={assignNpcId} onChange={(e) => setAssignNpcId(e.target.value)}>
                <option value="">Add an NPC...</option>
                {npcsThatCanBeAdded.map((n) => (
                  <option key={n.id} value={n.id}>{n.name} (Lv.{n.level})</option>
                ))}
              </select>
              <button onClick={handleAssignNPC} style={S.btnPrimary} disabled={!assignNpcId}>Add</button>
            </div>
          )}
        </div>
      )}

      {/* Factions (GM only) */}
      {isGM && (
        <div style={S.card}>
          <span style={S.sectionLbl}>Factions</span>
          {(campaign.factions || []).length === 0 && !factionForm && (
            <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '8px' }}>No factions created yet.</div>
          )}
          {(campaign.factions || []).map((f) => (
            <div key={f.id} style={{ padding: '8px 0', borderBottom: '1px solid #1f2937' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 'bold', color: '#e5e7eb' }}>{f.name}</span>
                  {f.faction_type && <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '8px' }}>({f.faction_type})</span>}
                </div>
                <div style={S.row}>
                  <button onClick={() => startFactionEdit(f)} style={{ ...S.btn, fontSize: '10px', padding: '2px 6px', background: '#374151', color: '#d1d5db' }}>Edit</button>
                  <button onClick={() => handleFactionDelete(f.id)} style={{ ...S.btn, fontSize: '10px', padding: '2px 6px', background: '#7f1d1d', color: '#fca5a5' }}>Del</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                <span>Tier {f.level}</span>
                <span>Hold: {f.hold === 'strong' ? 'Strong' : 'Weak'}</span>
                <span>Rep: {f.reputation}</span>
              </div>
              {f.notes && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{f.notes}</div>}
            </div>
          ))}

          {/* Faction form */}
          {factionForm && (
            <div style={{ border: '1px solid #7c3aed', borderRadius: '4px', padding: '12px', marginTop: '8px', background: '#0d1117' }}>
              <span style={S.lbl}>{factionForm.id ? 'EDIT FACTION' : 'CREATE FACTION'}</span>
              {factionError && <div style={{ ...S.err, marginBottom: '8px' }}>{factionError}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>Name</span>
                  <input style={S.inp} value={factionForm.name} onChange={(e) => setFactionForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>Type</span>
                  <input style={S.inp} value={factionForm.faction_type} onChange={(e) => setFactionForm((p) => ({ ...p, faction_type: e.target.value }))} placeholder="e.g. Criminal Syndicate" />
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>Tier</span>
                  <input style={{ ...S.inp, width: '80px' }} type="number" value={factionForm.level} onChange={(e) => setFactionForm((p) => ({ ...p, level: parseInt(e.target.value, 10) || 0 }))} />
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>Hold</span>
                  <select style={S.select} value={factionForm.hold} onChange={(e) => setFactionForm((p) => ({ ...p, hold: e.target.value }))}>
                    <option value="weak">Weak</option>
                    <option value="strong">Strong</option>
                  </select>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>Reputation</span>
                  <input style={{ ...S.inp, width: '80px' }} type="number" value={factionForm.reputation} onChange={(e) => setFactionForm((p) => ({ ...p, reputation: parseInt(e.target.value, 10) || 0 }))} />
                </div>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>Notes</span>
                <textarea
                  style={{ ...S.inp, height: '50px', resize: 'vertical', border: '1px solid #374151', background: '#0d1117', padding: '6px' }}
                  value={factionForm.notes}
                  onChange={(e) => setFactionForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
              <div style={S.row}>
                <button onClick={handleFactionSave} style={S.btnPrimary}>Save</button>
                <button onClick={() => { setFactionForm(null); setFactionError(null); }} style={S.btnGhost}>Cancel</button>
              </div>
            </div>
          )}
          {!factionForm && (
            <button onClick={startFactionCreate} style={{ ...S.btnPrimary, marginTop: '8px' }}>+ New Faction</button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function CampaignManagement({ initialCampaignId = null }) {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [selectedCampaignId, setSelectedCampaignId] = useState(initialCampaignId);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, invs] = await Promise.all([
        campaignAPI.getCampaigns(),
        campaignAPI.getInvitations().catch(() => []),
      ]);
      setCampaigns(list || []);
      setInvitations(invs || []);
    } catch (err) {
      setError(err.message || 'Failed to load campaigns');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  useEffect(() => {
    if (initialCampaignId != null && campaigns.length > 0 && campaigns.some((c) => c.id === initialCampaignId)) {
      setSelectedCampaignId(initialCampaignId);
    }
  }, [initialCampaignId, campaigns]);

  const startCreate = () => {
    setEditing('new');
    setForm({ name: '', description: '' });
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

  const handleAcceptInvitation = async (id) => {
    try {
      await campaignAPI.acceptInvitation(id);
      await loadCampaigns();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeclineInvitation = async (id) => {
    try {
      await campaignAPI.declineInvitation(id);
      await loadCampaigns();
    } catch (err) {
      setError(err.message);
    }
  };

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  // Refresh a single campaign in-place
  const refreshSelected = async () => {
    if (!selectedCampaignId) return;
    try {
      const fresh = await campaignAPI.getCampaign(selectedCampaignId);
      setCampaigns((prev) => prev.map((c) => (c.id === fresh.id ? fresh : c)));
    } catch {
      await loadCampaigns();
    }
  };

  // ---- Detail view ----
  if (selectedCampaign) {
    const isGM = selectedCampaign.gm?.id === user?.id;
    return (
      <div style={S.page}>
        <div style={S.content}>
          <CampaignDetail
            campaign={selectedCampaign}
            isGM={isGM}
            user={user}
            onBack={() => setSelectedCampaignId(null)}
            onRefresh={refreshSelected}
          />
        </div>
      </div>
    );
  }

  // ---- List view ----
  return (
    <div style={S.page}>
      <div style={S.content}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
          <button onClick={startCreate} style={S.btnSuccess}>+ New Campaign</button>
        </div>

        {error && <div style={S.err}>{error}</div>}

        <PendingInvitations invitations={invitations} onAccept={handleAcceptInvitation} onDecline={handleDeclineInvitation} />

        {editing != null && (
          <div style={{ ...S.card, border: '1px solid #7c3aed' }}>
            <span style={S.lbl}>CREATE CAMPAIGN</span>
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
              <button onClick={handleSave} style={S.btnPrimary}>Save</button>
              <button onClick={cancelEdit} style={S.btnGhost}>Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={S.emptyState}>Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div style={S.emptyState}>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>No campaigns yet</div>
            <div style={{ fontSize: '12px', marginBottom: '16px' }}>Create one to start organizing your sessions, NPCs, and factions.</div>
            <button onClick={startCreate} style={{ ...S.btnPrimary, fontSize: '13px' }}>
              + Create Your First Campaign
            </button>
          </div>
        ) : (
          campaigns.map((c) => {
            const isGM = c.gm?.id === user?.id;
            const charCount = (c.campaign_characters || []).length;
            const playerCount = (c.players || []).length;
            return (
              <div
                key={c.id}
                style={{ ...S.card, cursor: 'pointer' }}
                onClick={() => setSelectedCampaignId(c.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedCampaignId(c.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>{c.name || 'Unnamed Campaign'}</div>
                    {c.description && <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>{c.description}</div>}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <StatusBadge active={c.is_active !== false} />
                      <RoleBadge role={isGM ? 'GM' : 'Player'} />
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>
                        {playerCount} player{playerCount !== 1 ? 's' : ''} | {charCount} character{charCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: '#4b5563', whiteSpace: 'nowrap' }}>
                    {c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
