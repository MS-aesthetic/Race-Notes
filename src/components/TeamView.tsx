import React, { useState, useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { Team, TeamProfile } from '../types';
import {
  AppUser,
  createTeam,
  getUserTeam,
  getTeamMembers,
  addTeamMember,
  leaveTeam,
  deleteTeam,
  removeTeamMember,
  uploadTeamBanner,
  updateTeamProfile,
} from '../lib/supabase';
import ConfirmSheet from './ui/ConfirmSheet';

interface TeamViewProps {
  user: User;
}

type PendingTeamAction =
  | { kind: 'leave'; userId: string; teamId: string; teamName: string }
  | { kind: 'delete'; userId: string; teamId: string; teamName: string }
  | { kind: 'remove'; userId: string; teamId: string; memberId: string; memberName: string };

export default function TeamView({ user }: TeamViewProps) {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingTeamAction, setPendingTeamAction] = useState<PendingTeamAction | null>(null);
  const userIdRef = useRef(user.id);
  const teamIdRef = useRef<string | null>(team?.id ?? null);
  const membersRef = useRef(members);
  const loadGenerationRef = useRef(0);
  userIdRef.current = user.id;
  teamIdRef.current = team?.id ?? null;
  membersRef.current = members;

  // Team profile state
  const [profileDraft, setProfileDraft] = useState<TeamProfile>({});
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  // Is the current user the owner of the loaded team?
  const myMembership = members.find(m => m.id === user.id);
  const isOwner = myMembership?.role === 'owner';

  const loadTeam = async (expectedUserId = user.id) => {
    const generation = ++loadGenerationRef.current;
    const stillCurrentLoad = () => userIdRef.current === expectedUserId && loadGenerationRef.current === generation;
    setLoading(true);
    setError('');
    try {
      const userTeam = await getUserTeam(expectedUserId);
      if (!stillCurrentLoad()) return;
      setTeam(userTeam);
      if (userTeam) {
        const teamMbrs = await getTeamMembers(userTeam.id);
        if (!stillCurrentLoad() || teamIdRef.current !== userTeam.id) return;
        setMembers(teamMbrs);
        setProfileDraft(userTeam.profile || {});
      } else {
        setMembers([]);
      }
    } catch (err: any) {
      if (!stillCurrentLoad()) return;
      setError(err.message || 'Failed to load team.');
    } finally {
      if (stillCurrentLoad()) setLoading(false);
    }
  };

  useEffect(() => {
    void loadTeam(user.id);
  }, [user.id]);

  useEffect(() => {
    setPendingTeamAction(null);
  }, [user.id, team?.id]);

  const handleSaveProfile = async () => {
    if (!team) return;
    setProfileSaving(true);
    const ok = await updateTeamProfile(team.id, profileDraft);
    if (ok) {
      setTeam({ ...team, profile: profileDraft });
      setProfileEditing(false);
      setSuccess('Team profile saved.');
    } else {
      setError('Failed to save profile.');
    }
    setProfileSaving(false);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!newTeamName.trim()) return;

    setLoading(true);
    try {
      await createTeam(newTeamName.trim(), user.id);
      setSuccess('Team created successfully!');
      setNewTeamName('');
      await loadTeam();
    } catch (err: any) {
      setError(err.message || 'Failed to create team.');
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team || !inviteEmail.trim()) return;

    setLoading(true);
    setError('');
    setSuccess('');
    const ok = await addTeamMember(team.id, inviteEmail.trim());
    if (ok) {
      setSuccess('Member added to team!');
      setInviteEmail('');
      await loadTeam();
    } else {
      setError('Failed to add member. Is the email registered?');
      setLoading(false);
    }
  };

  const handleLeaveTeam = () => {
    if (!team) return;
    setPendingTeamAction({ kind: 'leave', userId: user.id, teamId: team.id, teamName: team.name });
  };

  const handleDeleteTeam = () => {
    if (!team) return;
    setPendingTeamAction({ kind: 'delete', userId: user.id, teamId: team.id, teamName: team.name });
  };

  const handleRemoveMember = (memberId: string, name: string) => {
    if (!team) return;
    setPendingTeamAction({ kind: 'remove', userId: user.id, teamId: team.id, memberId, memberName: name });
  };

  const confirmTeamAction = async () => {
    const pending = pendingTeamAction;
    setPendingTeamAction(null);
    if (!pending) return;
    if (userIdRef.current !== pending.userId || teamIdRef.current !== pending.teamId) return;
    if (pending.kind === 'remove' && !membersRef.current.some(member => member.id === pending.memberId)) return;
    setLoading(true);
    const stillCurrent = () => userIdRef.current === pending.userId && teamIdRef.current === pending.teamId;
    try {
      if (pending.kind === 'leave') {
        const ok = await leaveTeam(pending.teamId, pending.userId);
        if (!stillCurrent()) return;
        if (ok) {
          setTeam(null);
          setMembers([]);
          setSuccess('You left the team.');
        } else {
          setError('Failed to leave team.');
        }
        return;
      }
      if (pending.kind === 'delete') {
        const ok = await deleteTeam(pending.teamId);
        if (!stillCurrent()) return;
        if (ok) {
          setTeam(null);
          setMembers([]);
          setSuccess('Team deleted.');
        } else {
          setError('Failed to delete team. Only the owner can delete it.');
        }
        return;
      }
      const ok = await removeTeamMember(pending.teamId, pending.memberId);
      if (!stillCurrent()) return;
      if (ok) {
        setSuccess(`${pending.memberName} removed.`);
        await loadTeam(pending.userId);
      } else {
        setError('Failed to remove member.');
      }
    } catch {
      if (!stillCurrent()) return;
      setError(pending.kind === 'leave'
        ? 'Failed to leave team.'
        : pending.kind === 'delete'
          ? 'Failed to delete team. Only the owner can delete it.'
          : 'Failed to remove member.');
    } finally {
      if (stillCurrent()) setLoading(false);
    }
  };

  const pendingTeamCopy = pendingTeamAction?.kind === 'leave'
    ? {
        title: `Leave ${pendingTeamAction.teamName}?`,
        body: `Are you sure you want to leave ${pendingTeamAction.teamName}?`,
        confirmLabel: 'Leave',
        destructive: false,
      }
    : pendingTeamAction?.kind === 'delete'
      ? {
          title: `Delete ${pendingTeamAction.teamName}?`,
          body: `Permanently DELETE "${pendingTeamAction.teamName}"? This removes the team for ALL members and cannot be undone.`,
          confirmLabel: 'Delete',
          destructive: true,
        }
      : {
          title: `Remove ${pendingTeamAction?.memberName ?? 'member'}?`,
          body: `Remove ${pendingTeamAction?.memberName ?? 'member'} from the team?`,
          confirmLabel: 'Remove',
          destructive: false,
        };

  const handleUploadBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!team) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setSuccess('');
    const url = await uploadTeamBanner(team.id, file);
    if (url) {
      setSuccess('Banner updated!');
      setTeam({ ...team, banner_url: url });
    } else {
      setError('Failed to upload banner.');
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center text-sm font-mono p-4 text-on-surface-variant">Loading team data...</div>;
  }

  // ---- NO TEAM: Create one ----
  if (!team) {
    return (
      <div className="flex flex-col gap-4 text-left">
        <div className="bg-surface-container border border-outline-variant/30 p-4 rounded-lg">
          <h3 className="font-display font-bold text-sm text-primary uppercase mb-2">Team Sync</h3>
          <p className="text-xs text-on-surface-variant mb-4 font-mono leading-relaxed">
            Create a team to automatically sync all your setups, session logs, and to-do lists with your crew chiefs and mechanics.
          </p>
          <form onSubmit={handleCreateTeam} className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Team Name (e.g. Smith Racing)"
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              className="bg-surface border border-outline-variant/50 p-2 text-sm font-mono rounded w-full text-on-surface"
            />
            {error && <span className="text-red-400 text-[10px] uppercase font-mono">{error}</span>}
            {success && <span className="text-green-400 text-[10px] uppercase font-mono">{success}</span>}
            <button
              type="submit"
              disabled={loading || !newTeamName.trim()}
              className="bg-primary text-on-primary font-bold text-xs uppercase font-mono py-2 rounded mt-1 disabled:opacity-50"
            >
              Create Team
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ---- HAS TEAM: Manage it ----
  return (
    <div className="flex flex-col gap-4 text-left">
      <div className="bg-surface-container border border-outline-variant/30 p-4 rounded-lg flex flex-col gap-3">
        <div className="flex justify-between items-start border-b border-outline-variant/30 pb-2">
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase font-mono tracking-wider">Active Team</p>
            <h3 className="font-display font-bold text-sm text-on-surface uppercase">{team.name}</h3>
            <span className="text-[9px] uppercase font-bold font-mono text-primary">{isOwner ? 'Owner' : 'Member'}</span>
          </div>
        </div>

        {team.banner_url && (
          <img src={team.banner_url} alt="Team Banner" className="w-full h-24 object-cover rounded-md opacity-80" />
        )}

        {isOwner && (
          <div className="flex items-center gap-2">
            <label className="bg-surface text-on-surface-variant hover:text-primary text-[10px] uppercase font-mono px-3 py-1.5 rounded border border-outline-variant/30 cursor-pointer">
              <input type="file" className="hidden" accept="image/*" onChange={handleUploadBanner} />
              Upload Team Banner
            </label>
          </div>
        )}

        {/* ROSTER */}
        <div>
          <p className="text-[10px] text-on-surface-variant uppercase font-mono tracking-wider mb-2 mt-2">Roster ({members.length})</p>
          <div className="flex flex-col gap-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between bg-surface-container-lowest p-2 rounded border border-outline-variant/30">
                <div className="flex flex-col">
                  <span className="text-xs font-mono text-on-surface">{m.displayName || m.email}</span>
                  <span className="text-[9px] uppercase font-mono text-on-surface-muted">{m.role}</span>
                </div>
                <div className="flex items-center gap-2">
                  {m.id === user.id && (
                    <span className="text-[9px] uppercase font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">You</span>
                  )}
                  {isOwner && m.id !== user.id && (
                    <button
                      onClick={() => handleRemoveMember(m.id, m.displayName || m.email || 'member')}
                      title="Remove member"
                      className="material-symbols-outlined text-[16px] text-on-surface-muted hover:text-red-400"
                    >
                      person_remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* INVITE (owner only) */}
        {isOwner && (
          <form onSubmit={handleInvite} className="mt-2 flex gap-2">
            <input
              type="email"
              placeholder="Invite by email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="flex-1 bg-surface border border-outline-variant/50 p-2 text-xs font-mono rounded text-on-surface placeholder:text-on-surface-muted"
            />
            <button
              type="submit"
              disabled={loading || !inviteEmail.trim()}
              className="bg-primary text-on-primary font-bold text-xs uppercase px-3 rounded disabled:opacity-50"
            >
              Add
            </button>
          </form>
        )}

        {error && <span className="text-red-400 text-[10px] uppercase font-mono mt-1">{error}</span>}
        {success && <span className="text-green-400 text-[10px] uppercase font-mono mt-1">{success}</span>}

        {/* TEAM PROFILE */}
        <div className="border-t border-outline-variant/30 pt-3 mt-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-on-surface-variant uppercase font-mono tracking-wider">Team / Driver Profile</p>
            {isOwner && !profileEditing && (
              <button
                onClick={() => { setProfileDraft(team.profile || {}); setProfileEditing(true); }}
                className="text-[10px] font-mono uppercase font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[13px]">edit</span>
                Edit
              </button>
            )}
          </div>

          {profileEditing && isOwner ? (
            <div className="space-y-2">
              {([
                { key: 'carNumber',      label: 'Car Number',       placeholder: 'e.g. 4x' },
                { key: 'division',       label: 'Division',         placeholder: 'e.g. Street Stock' },
                { key: 'hometown',       label: 'Hometown',         placeholder: 'City, State' },
                { key: 'age',            label: 'Age',              placeholder: 'e.g. 28' },
                { key: 'transponderIds', label: 'Transponder ID#',  placeholder: 'e.g. 123456789' },
                { key: 'racePassUrl',    label: 'MyRacePass URL',   placeholder: 'https://www.myracepass.com/drivers/...' },
              ] as { key: keyof TeamProfile; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-[9px] font-mono uppercase text-on-surface-muted mb-0.5 tracking-wider">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={profileDraft[key] || ''}
                    onChange={e => setProfileDraft(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full bg-surface border border-outline-variant/50 focus:border-primary p-2 text-xs font-mono rounded text-on-surface outline-none"
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="flex-1 bg-primary text-on-primary font-bold text-[10px] uppercase font-mono py-2 rounded disabled:opacity-50"
                >
                  {profileSaving ? 'Saving…' : 'Save Profile'}
                </button>
                <button
                  onClick={() => setProfileEditing(false)}
                  className="px-4 py-2 border border-outline-variant/50 text-on-surface-variant font-mono text-[10px] uppercase rounded hover:border-outline-variant"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {team.profile && Object.values(team.profile).some(v => v) ? (
                <>
                  {team.profile.carNumber && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Car #</span>
                      <span className="font-mono text-xs font-bold text-on-surface">{team.profile.carNumber}</span>
                    </div>
                  )}
                  {team.profile.division && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Division</span>
                      <span className="font-mono text-xs font-bold text-on-surface">{team.profile.division}</span>
                    </div>
                  )}
                  {team.profile.hometown && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Hometown</span>
                      <span className="font-mono text-xs font-bold text-on-surface">{team.profile.hometown}</span>
                    </div>
                  )}
                  {team.profile.age && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Age</span>
                      <span className="font-mono text-xs font-bold text-on-surface">{team.profile.age}</span>
                    </div>
                  )}
                  {team.profile.transponderIds && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Transponder</span>
                      <span className="font-mono text-xs font-bold text-on-surface">{team.profile.transponderIds}</span>
                    </div>
                  )}
                  {team.profile.racePassUrl && (
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider shrink-0">MyRacePass</span>
                      <a
                        href={team.profile.racePassUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[10px] text-primary underline truncate"
                      >
                        {team.profile.racePassUrl.replace('https://www.', '')}
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[10px] font-mono text-on-surface-muted italic">
                  {isOwner ? 'No profile info yet — tap Edit to add details.' : 'No profile info set.'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* DANGER ZONE */}
        <div className="border-t border-outline-variant/30 pt-3 mt-2 flex flex-col gap-2">
          <button
            onClick={handleLeaveTeam}
            className="w-full py-2 px-4 bg-surface border border-outline-variant/40 text-on-surface-variant hover:text-on-surface font-mono text-[10px] uppercase tracking-wider rounded flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            Leave Team
          </button>
          {isOwner && (
            <button
              onClick={handleDeleteTeam}
              className="w-full py-2 px-4 bg-red-900/20 border border-red-800/40 text-red-400 hover:bg-red-900/30 font-mono text-[10px] uppercase tracking-wider rounded flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">delete_forever</span>
              Delete Team
            </button>
          )}
        </div>
      </div>
      <ConfirmSheet
        open={!!pendingTeamAction}
        title={pendingTeamCopy.title}
        body={pendingTeamCopy.body}
        confirmLabel={pendingTeamCopy.confirmLabel}
        cancelLabel="Keep"
        destructive={pendingTeamCopy.destructive}
        onConfirm={confirmTeamAction}
        onCancel={() => setPendingTeamAction(null)}
      />
    </div>
  );
}
