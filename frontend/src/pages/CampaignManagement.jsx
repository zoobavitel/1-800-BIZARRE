import React, { useState, useEffect, useCallback } from 'react';
import { campaignAPI, characterAPI, factionAPI, npcAPI, sessionAPI, progressClockAPI, rollAPI, crewAPI } from '../features/character-sheet';
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
function CampaignDetail({ campaign, isGM, user, onBack, onRefresh, onManageSessions }) {
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
                  <button onClick={onManageSessions} style={S.btnPrimary}>Manage Sessions</button>
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
// Session List View
// ---------------------------------------------------------------------------
function SessionList({ campaign, onBack, onSelectSession, onRefresh }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    sessionAPI.getSessions(campaign.id).then(setSessions).catch((e) => { setError(e.message); setSessions([]); }).finally(() => setLoading(false));
  }, [campaign.id]);

  const handleCreateSession = async () => {
    setCreating(true);
    setError(null);
    try {
      const session = await sessionAPI.createSession({ campaign: campaign.id, name: `Session ${(sessions?.length || 0) + 1}`, status: 'PLANNED' });
      setSessions((prev) => [session, ...(prev || [])]);
      onSelectSession(session);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <button onClick={onBack} style={{ ...S.btnGhost, marginBottom: '12px' }}>{'< Back to Campaign'}</button>
      {error && <div style={S.err}>{error}</div>}
      <div style={{ ...S.card, border: '1px solid #4b5563' }}>
        <span style={S.sectionLbl}>Sessions</span>
        <button onClick={handleCreateSession} style={S.btnSuccess} disabled={creating}>{creating ? 'Creating...' : '+ New Session'}</button>
        {loading ? (
          <div style={{ color: '#6b7280', padding: '16px' }}>Loading sessions...</div>
        ) : !sessions?.length ? (
          <div style={{ color: '#6b7280', padding: '16px' }}>No sessions yet. Create one to get started.</div>
        ) : (
          <div style={{ marginTop: '12px' }}>
            {sessions.map((s) => (
              <div
                key={s.id}
                style={{ ...S.card, cursor: 'pointer', marginBottom: '8px' }}
                onClick={() => onSelectSession(s)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelectSession(s)}
              >
                <div style={{ fontWeight: 'bold' }}>{s.name || `Session ${s.id}`}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                  {s.session_date ? new Date(s.session_date).toLocaleDateString() : 'N/A'} · {s.status || 'PLANNED'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session Detail View (GM-only)
// ---------------------------------------------------------------------------
function SessionDetail({ campaign, session, onBack, onRefresh }) {
  const [sessionData, setSessionData] = useState(session);
  const [rolls, setRolls] = useState([]);
  const [clocks, setClocks] = useState([]);
  const [crews, setCrews] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [campaignNPCs, setCampaignNPCs] = useState([]);
  const [showPositionEffect, setShowPositionEffect] = useState(false);
  const [fortuneDice, setFortuneDice] = useState(2);
  const [fortuneRolling, setFortuneRolling] = useState(false);
  const [error, setError] = useState(null);
  const [wantedStars, setWantedStars] = useState(campaign?.wanted_stars ?? 0);

  useEffect(() => {
    if (!session?.id) return;
    sessionAPI.getSession(session.id).then(setSessionData).catch(() => setSessionData(session));
    rollAPI.getRolls({ session: session.id }).then(setRolls).catch(() => setRolls([]));
    progressClockAPI.getProgressClocks({ campaign: campaign.id, session: session.id }).then(setClocks).catch(() => setClocks([]));
    crewAPI.getCrews().then((list) => setCrews(list?.filter((c) => c.campaign === campaign.id) || [])).catch(() => setCrews([]));
    characterAPI.getCharacters().then((list) => setCharacters(list?.filter((c) => c.campaign === campaign.id) || [])).catch(() => setCharacters([]));
    npcAPI.getNPCs(campaign.id).then(setCampaignNPCs).catch(() => setCampaignNPCs([]));
    setWantedStars(campaign?.wanted_stars ?? 0);
  }, [session?.id, campaign?.id, campaign?.wanted_stars]);

  const campaignChars = campaign?.campaign_characters || characters.map((c) => ({ id: c.id, true_name: c.true_name, ...c }));

  const handleWantedStars = async (stars) => {
    setWantedStars(stars);
    try {
      await campaignAPI.patchCampaign(campaign.id, { wanted_stars: stars });
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSetActiveSession = async () => {
    try {
      await campaignAPI.patchCampaign(campaign.id, { active_session: session.id });
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const handlePatchCharacterHarm = async (charId, harmData) => {
    try {
      await characterAPI.patchCharacter(charId, harmData);
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleUpdateSession = async (data) => {
    try {
      const updated = await sessionAPI.patchSession(session.id, data);
      setSessionData(updated);
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const handlePatchRoll = async (rollId, data) => {
    try {
      await rollAPI.patchRoll(rollId, data);
      setRolls((prev) => prev.map((r) => (r.id === rollId ? { ...r, ...data } : r)));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleFortuneRoll = async () => {
    setFortuneRolling(true);
    setError(null);
    const firstChar = campaignChars[0] || characters[0];
    if (!firstChar?.id) {
      setError('No character in campaign to roll fortune.');
      setFortuneRolling(false);
      return;
    }
    try {
      const res = await characterAPI.rollAction(firstChar.id, {
        roll_type: 'FORTUNE',
        action: 'Fortune',
        session_id: session.id,
        dice_pool: fortuneDice,
      });
      rollAPI.getRolls({ session: session.id }).then(setRolls).catch(() => {});
      onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setFortuneRolling(false);
    }
  };

  const npcsInvolved = sessionData?.npcs_involved || [];
  const toggleNpcInvolved = async (npcId) => {
    const next = npcsInvolved.includes(npcId)
      ? npcsInvolved.filter((id) => id !== npcId)
      : [...npcsInvolved, npcId];
    try {
      const updated = await sessionAPI.patchSession(session.id, { npcs_involved: next });
      setSessionData(updated);
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const [coinEdits, setCoinEdits] = useState({});
  const handleCrewCoinChange = async (crewId, coin) => {
    const val = parseInt(coin, 10) || 0;
    try {
      await crewAPI.patchCrew(crewId, { coin: val });
      setCrews((prev) => prev.map((c) => (c.id === crewId ? { ...c, coin: val } : c)));
      setCoinEdits((p) => { const n = { ...p }; delete n[crewId]; return n; });
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <button onClick={onBack} style={{ ...S.btnGhost, marginBottom: '12px' }}>{'< Back to Sessions'}</button>
      {error && <div style={S.err}>{error}</div>}

      <div style={S.card}>
        <span style={S.sectionLbl}>Session: {sessionData?.name || session?.name || 'Unnamed'}</span>
        <button onClick={handleSetActiveSession} style={S.btnPrimary}>Set as current session (enable for players)</button>
      </div>

      {/* Wanted level */}
      <div style={S.card}>
        <span style={S.sectionLbl}>Wanted Level</span>
        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => handleWantedStars(n)}
              style={{
                ...S.btn,
                background: n <= wantedStars ? '#fbbf24' : '#374151',
                color: n <= wantedStars ? '#000' : '#9ca3af',
                width: '28px',
                height: '28px',
                padding: 0,
              }}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {/* Harm for players */}
      <div style={S.card}>
        <span style={S.sectionLbl}>Harm for Players</span>
        {campaignChars.length === 0 ? (
          <div style={{ color: '#6b7280' }}>No characters in campaign.</div>
        ) : (
          campaignChars.map((ch) => (
            <HarmEditor key={ch.id} character={ch} onSave={(data) => handlePatchCharacterHarm(ch.id, data)} />
          ))
        )}
      </div>

      {/* Goals */}
      <GoalsEditor sessionData={sessionData} onSave={handleUpdateSession} />

      {/* NPCs used */}
      <div style={S.card}>
        <span style={S.sectionLbl}>NPCs Used</span>
        {campaignNPCs.length === 0 ? (
          <div style={{ color: '#6b7280' }}>No NPCs in campaign.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
            {campaignNPCs.map((npc) => (
              <label key={npc.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={npcsInvolved.includes(npc.id)}
                  onChange={() => toggleNpcInvolved(npc.id)}
                />
                <span>{npc.name || npc.true_name || `NPC ${npc.id}`}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Coin (crew-level) */}
      <div style={S.card}>
        <span style={S.sectionLbl}>Coin</span>
        {crews.length === 0 ? (
          <div style={{ color: '#6b7280' }}>No crews in campaign.</div>
        ) : (
          crews.map((crew) => (
            <div key={crew.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <span style={{ minWidth: '120px' }}>{crew.name || `Crew ${crew.id}`}</span>
              <input
                type="number"
                style={{ ...S.inp, width: '60px' }}
                value={coinEdits[crew.id] !== undefined ? coinEdits[crew.id] : (crew.coin ?? 0)}
                onChange={(e) => setCoinEdits((p) => ({ ...p, [crew.id]: e.target.value }))}
                onBlur={(e) => handleCrewCoinChange(crew.id, e.target.value)}
              />
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>coin</span>
            </div>
          ))
        )}
      </div>

      {/* Fortune rolls */}
      <div style={S.card}>
        <span style={S.sectionLbl}>Fortune Rolls</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
          <span style={{ fontSize: '11px' }}>Dice pool:</span>
          <select style={S.select} value={fortuneDice} onChange={(e) => setFortuneDice(parseInt(e.target.value, 10))}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n}d</option>
            ))}
          </select>
          <button onClick={handleFortuneRoll} style={S.btnPrimary} disabled={fortuneRolling || !campaignChars?.length}>
            {fortuneRolling ? 'Rolling...' : 'Roll Fortune'}
          </button>
        </div>
      </div>

      {/* Clocks */}
      <div style={S.card}>
        <span style={S.sectionLbl}>Clocks</span>
        <div style={{ marginBottom: '8px' }}>
          <button onClick={async () => { try { await progressClockAPI.createProgressClock({ campaign: campaign.id, session: session.id, name: 'New Clock', clock_type: 'CUSTOM', max_segments: 4 }); const list = await progressClockAPI.getProgressClocks({ session: session.id }); setClocks(list || []); } catch (e) { setError(e.message); } }} style={S.btnPrimary}>+ New Clock</button>
        </div>
        {clocks.map((clk) => (
          <div key={clk.id} style={{ padding: '8px 0', borderBottom: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{clk.name} ({clk.filled_segments}/{clk.max_segments})</span>
            <label style={{ fontSize: '11px' }}>
              <input type="checkbox" checked={clk.visible_to_players} onChange={(e) => progressClockAPI.updateProgressClock(clk.id, { visible_to_players: e.target.checked }).then(() => setClocks((p) => p.map((c) => c.id === clk.id ? { ...c, visible_to_players: e.target.checked } : c)))} />
              Visible to players
            </label>
          </div>
        ))}
      </div>

      {/* Dice history */}
      <div style={S.card}>
        <span style={S.sectionLbl}>Dice History</span>
        <label style={{ fontSize: '11px', marginBottom: '8px', display: 'block' }}>
          <input type="checkbox" checked={showPositionEffect} onChange={(e) => setShowPositionEffect(e.target.checked)} />
          Show position & effect
        </label>
        {rolls.length === 0 ? (
          <div style={{ color: '#6b7280' }}>No rolls for this session.</div>
        ) : (
          rolls.map((r) => (
            <div key={r.id} style={{ padding: '6px 0', borderBottom: '1px solid #1f2937', fontSize: '12px' }}>
              <span style={{ fontWeight: 'bold' }}>{r.character_name || r.character}</span> · {r.action_name} · {r.results?.join(', ')} → {r.outcome}
              {showPositionEffect && (
                <span style={{ color: '#9ca3af', marginLeft: '8px' }}>
                  ({r.position}, {r.effect})
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function GoalsEditor({ sessionData, onSave }) {
  const [form, setForm] = useState({ objective: '', proposed_score_target: '', proposed_score_description: '' });
  useEffect(() => {
    setForm({
      objective: sessionData?.objective || '',
      proposed_score_target: sessionData?.proposed_score_target || '',
      proposed_score_description: sessionData?.proposed_score_description || '',
    });
  }, [sessionData?.id]);
  return (
    <div style={S.card}>
      <span style={S.sectionLbl}>Goals / Items</span>
      <div style={{ marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', color: '#9ca3af' }}>Objective</span>
        <textarea style={{ ...S.inp, height: '50px', border: '1px solid #374151', padding: '6px' }} value={form.objective} onChange={(e) => setForm((p) => ({ ...p, objective: e.target.value }))} />
      </div>
      <div style={{ marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', color: '#9ca3af' }}>Proposed score target</span>
        <input style={S.inp} value={form.proposed_score_target} onChange={(e) => setForm((p) => ({ ...p, proposed_score_target: e.target.value }))} />
      </div>
      <div style={{ marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', color: '#9ca3af' }}>Proposed score description</span>
        <textarea style={{ ...S.inp, height: '40px', border: '1px solid #374151', padding: '6px' }} value={form.proposed_score_description} onChange={(e) => setForm((p) => ({ ...p, proposed_score_description: e.target.value }))} />
      </div>
      <button onClick={() => onSave(form)} style={S.btnPrimary}>Save goals</button>
    </div>
  );
}

function HarmEditor({ character, onSave }) {
  const [harm, setHarm] = useState({
    harm_level1_used: character.harm_level1_used ?? false,
    harm_level1_name: character.harm_level1_name || '',
    harm_level2_used: character.harm_level2_used ?? false,
    harm_level2_name: character.harm_level2_name || '',
    harm_level3_used: character.harm_level3_used ?? false,
    harm_level3_name: character.harm_level3_name || '',
    harm_level4_used: character.harm_level4_used ?? false,
    harm_level4_name: character.harm_level4_name || '',
  });
  useEffect(() => {
    setHarm({
      harm_level1_used: character.harm_level1_used ?? false,
      harm_level1_name: character.harm_level1_name || '',
      harm_level2_used: character.harm_level2_used ?? false,
      harm_level2_name: character.harm_level2_name || '',
      harm_level3_used: character.harm_level3_used ?? false,
      harm_level3_name: character.harm_level3_name || '',
      harm_level4_used: character.harm_level4_used ?? false,
      harm_level4_name: character.harm_level4_name || '',
    });
  }, [character.id]);
  const save = () => onSave(harm);
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid #1f2937' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{character.true_name || character.alias || 'Unnamed'}</div>
      {[1, 2, 3, 4].map((n) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <input type="checkbox" checked={harm[`harm_level${n}_used`]} onChange={(e) => setHarm((p) => ({ ...p, [`harm_level${n}_used`]: e.target.checked }))} />
          <input style={{ ...S.inp, flex: 1, maxWidth: '200px' }} placeholder={`Level ${n} harm`} value={harm[`harm_level${n}_name`]} onChange={(e) => setHarm((p) => ({ ...p, [`harm_level${n}_name`]: e.target.value }))} />
        </div>
      ))}
      <button onClick={save} style={{ ...S.btn, marginTop: '6px', fontSize: '10px' }}>Save harm</button>
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
  const [sessionView, setSessionView] = useState(null); // null | 'list' | 'detail'
  const [selectedSession, setSelectedSession] = useState(null);

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

  // ---- Session detail view ----
  if (selectedCampaign && sessionView === 'detail' && selectedSession) {
    return (
      <div style={S.page}>
        <div style={S.content}>
          <SessionDetail
            campaign={selectedCampaign}
            session={selectedSession}
            onBack={() => { setSessionView('list'); setSelectedSession(null); }}
            onRefresh={refreshSelected}
          />
        </div>
      </div>
    );
  }

  // ---- Session list view ----
  if (selectedCampaign && sessionView === 'list') {
    return (
      <div style={S.page}>
        <div style={S.content}>
          <SessionList
            campaign={selectedCampaign}
            onBack={() => setSessionView(null)}
            onSelectSession={(session) => { setSelectedSession(session); setSessionView('detail'); }}
            onRefresh={refreshSelected}
          />
        </div>
      </div>
    );
  }

  // ---- Campaign detail view ----
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
            onManageSessions={() => setSessionView('list')}
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
