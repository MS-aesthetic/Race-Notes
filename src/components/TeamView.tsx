import React, { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { Team } from '../types';
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
} from '../lib/supabase';

interface TeamViewProps {
  user: User;
}

export default function TeamView({ user }: TeamViewProps) {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Is the current user the owner of the loaded team?
  const myMembership = members.find(m => m.id === user.id);
  const isOwner = myMembership?.role === 'owner';

  useEffect(() => {
    loadTeam();
  }, [user.id]);

  const loadTeam = async () => {
    setLoading(true);
    setError('');
    try {
      const userTeam = await getUserTeam(user.id);
      setTeam(userTeam);
      if (userTeam) {
        const teamMbrs = await getTeamMembers(userTeam.id);
        setMembers(teamMbrs);
      } else {
        setMembers([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load team.');
    }
    setLoading(false);
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

  const handleLeaveTeam = async () => {
    if (!team) return;
    if (!window.confirm(`Are you sure you want to leave ${team.name}?`)) return;
    setLoading(true);
    const ok = await leaveTeam(team.id, user.id);
    if (ok) {
      setTeam(null);
      setMembers([]);
      setSuccess('You left the team.');
    } else {
      setError('Failed to leave team.');
    }
    setLoading(false);
  };

  const handleDeleteTeam = async () => {
    if (!team) return;
    if (!window.confirm(`Permanently DELETE "${team.name}"? This removes the team for ALL members and cannot be undone.`)) return;
    setLoading(true);
    const ok = await deleteTeam(team.id);
    if (ok) {
      setTeam(null);
      setMembers([]);
      setSuccess('Team deleted.');
    } else {
      setError('Failed to delete team. Only the owner can delete it.');
    }
    setLoading(false);
  };

  const handleRemoveMember = async (memberId: string, name: string) => {
    if (!team) return;
    if (!window.confirm(`Remove ${name} from the team?`)) return;
    setLoading(true);
    const ok = await removeTeamMember(team.id, memberId);
    if (ok) {
      setSuccess(`${name} removed.`);
      await loadTeam();
    } else {
      setError('Failed to remove member.');
      setLoading(false);
    }
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
              className="bg-[#0e0e0e] border border-outline-variant/50 p-2 text-sm font-mono rounded w-full text-on-surface"
            />
            {error && <span className="text-red-400 text-[10px] uppercase font-mono">{error}</span>}
            {success && <span className="text-green-400 text-[10px] uppercase font-mono">{success}</span>}
            <button
              type="submit"
              disabled={loading || !newTeamName.trim()}
              className="bg-primary text-[#0e0e0e] font-bold text-xs uppercase font-mono py-2 rounded mt-1 disabled:opacity-50"
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
            <label className="bg-[#0e0e0e] text-on-surface-variant hover:text-primary text-[10px] uppercase font-mono px-3 py-1.5 rounded border border-outline-variant/30 cursor-pointer">
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
              <div key={m.id} className="flex items-center justify-between bg-[#0e0e0e] p-2 rounded border border-outline-variant/30">
                <div className="flex flex-col">
                  <span className="text-xs font-mono text-on-surface">{m.displayName || m.email}</span>
                  <span className="text-[9px] uppercase font-mono text-on-surface-variant/60">{m.role}</span>
                </div>
                <div className="flex items-center gap-2">
                  {m.id === user.id && (
                    <span className="text-[9px] uppercase font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">You</span>
                  )}
                  {isOwner && m.id !== user.id && (
                    <button
                      onClick={() => handleRemoveMember(m.id, m.displayName || m.email || 'member')}
                      title="Remove member"
                      className="material-symbols-outlined text-[16px] text-on-surface-variant/60 hover:text-red-400"
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
              className="flex-1 bg-[#0e0e0e] border border-outline-variant/50 p-2 text-xs font-mono rounded text-on-surface placeholder:text-on-surface-variant/40"
            />
            <button
              type="submit"
              disabled={loading || !inviteEmail.trim()}
              className="bg-primary text-[#0e0e0e] font-bold text-xs uppercase px-3 rounded disabled:opacity-50"
            >
              Add
            </button>
          </form>
        )}

        {error && <span className="text-red-400 text-[10px] uppercase font-mono mt-1">{error}</span>}
        {success && <span className="text-green-400 text-[10px] uppercase font-mono mt-1">{success}</span>}

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
    </div>
  );
}
