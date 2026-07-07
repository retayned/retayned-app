// ─── useOrg (Agency spine, Jun 12 2026) ─────────────────────────────────
// Resolves the signed-in user's org membership once per session and
// exposes the three values the whole Agency layer keys on:
//
//   org          — the orgs row (null for every solo user, forever)
//   orgRole      — 'owner' | 'am' | null
//   bookOwnerId  — whose client book this person works in:
//                    · solo user / root owner → their own user id
//                    · seat (am or second owner) → the org's
//                      owner_user_id (all client data lives there)
//
// Solo guarantee: when no membership exists, org=null and
// bookOwnerId === user.id, so every downstream path is byte-identical
// to today. The query is one indexed lookup and runs once.
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useOrg(user) {
  const [state, setState] = useState({ org: null, orgRole: null, bookOwnerId: user?.id || null, orgLoading: !!user });
  // Bumping this re-runs the resolution effect — used by the Agency
  // activation card after creating the org (Jul 2026).
  const [refetchTick, setRefetchTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) { setState({ org: null, orgRole: null, bookOwnerId: null, orgLoading: false }); return; }
    (async () => {
      try {
        // Am I the root owner of an org?
        const { data: owned } = await supabase
          .from('orgs').select('*').eq('owner_user_id', user.id).maybeSingle();
        if (!cancelled && owned) {
          setState({ org: owned, orgRole: 'owner', bookOwnerId: user.id, orgLoading: false });
          return;
        }
        // Am I an active seat in someone else's org?
        const { data: membership } = await supabase
          .from('org_members')
          .select('role, org_id, orgs!inner(id, name, owner_user_id, plan, seat_limit)')
          .eq('user_id', user.id).eq('status', 'active').maybeSingle();
        if (!cancelled) {
          if (membership?.orgs) {
            setState({
              org: membership.orgs,
              orgRole: membership.role,
              bookOwnerId: membership.orgs.owner_user_id,
              orgLoading: false,
            });
          } else {
            setState({ org: null, orgRole: null, bookOwnerId: user.id, orgLoading: false });
          }
        }
      } catch (_) {
        // Any failure degrades to solo behavior — never block the app.
        if (!cancelled) setState({ org: null, orgRole: null, bookOwnerId: user.id, orgLoading: false });
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, refetchTick]);
  return { ...state, refetchOrg: () => setRefetchTick(t => t + 1) };
}

// Role gating in one place (scope §4.2). Usage: can('edit_billing', orgRole)
export function can(action, orgRole) {
  // Solo users (orgRole null) can do everything — they ARE the owner.
  if (orgRole == null || orgRole === 'owner') return true;
  const AM_DENIED = new Set([
    'edit_billing',      // money edits are an owner act (scope §10.2)
    'view_rolodex',      // owner-level pipeline (scope §10.3)
    'view_referrals',    // same surface family (A2-6)
    'manage_workers',    // worker admin + magic tokens stay owner-side
    'manage_org',        // seats, roles, assignments
    'delete_client',     // client lifecycle is owner-role
  ]);
  return !AM_DENIED.has(action);
}
