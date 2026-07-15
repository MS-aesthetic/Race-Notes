import type { ReactNode } from 'react';

const PUBLIC_PRIVACY_URL = 'https://crew-chief-race-notes.netlify.app/privacy/';
const PUBLIC_DELETE_URL = 'https://crew-chief-race-notes.netlify.app/delete-account/';

export default function PrivacyPolicyView() {
  return (
    <div className="space-y-5 pb-4 text-sm text-on-surface">
      <div>
        <p className="font-mono text-xs text-on-surface-variant">Effective July 15, 2026</p>
        <p className="mt-2 text-on-surface-variant">
          CREW CHIEF is a local-first racing logbook provided by Nimbus Engineering. This policy
          explains what data the app uses, why it is used, and how you can delete it.
        </p>
      </div>

      <PolicySection title="Data we handle">
        Account details such as email, display name, avatar, and sign-in provider; race records,
        setups, checklists, maintenance, accounting entries, notes, photos, files, team membership,
        and device notification tokens you choose to save. Location is used only when you choose a
        location or routing feature.
      </PolicySection>
      <PolicySection title="How data is used">
        Data runs the app, syncs your records between devices, supports team sharing, sends requested
        notifications, and provides optional weather, track search, or routing results. We do not sell
        personal data and the app does not run third-party advertising.
      </PolicySection>
      <PolicySection title="Storage and service providers">
        Records may stay on your device and, when signed in, in Supabase cloud services. Netlify hosts
        the web app and deletion-request form. Google supplies sign-in and push messaging. Optional
        location tools may contact OpenStreetMap Nominatim, Open-Meteo, or HERE with the location or
        route information needed for that request.
      </PolicySection>
      <PolicySection title="Team sharing">
        Records shared through a team can be seen or edited by team members according to app access
        rules. Uploaded attachments use public-link URLs, so anyone given a file link can view that file.
        Deleting your account removes your account and owned records. Shared history that must remain
        useful to teammates may be kept without your user identity.
      </PolicySection>
      <PolicySection title="Retention and deletion">
        Local records remain until you clear them, remove the app data, or delete your account. Cloud
        records remain while your account is active or as needed to provide the service. Delete Account
        in Settings removes your cloud account, owned uploads, owned records, and this device's CREW
        CHIEF data. This cannot be undone.
      </PolicySection>
      <PolicySection title="Security and choices">
        The app uses account authentication and database access controls, but no system can guarantee
        absolute security. You control optional location, notifications, files, and team sharing through
        the app and device settings.
      </PolicySection>
      <PolicySection title="Children">
        CREW CHIEF is not directed to children under 13, and we do not knowingly collect their personal
        information.
      </PolicySection>
      <PolicySection title="Questions or deletion requests">
        Use Delete Account in the signed-in app for immediate deletion. If you cannot sign in, use the
        public request page. Choose Privacy question for other privacy requests. We may need to verify
        account ownership before acting.
      </PolicySection>

      <div className="grid gap-2">
        <a className="min-h-11 rounded-lg border border-outline-variant px-3 py-3 text-center font-mono text-xs text-primary" href={PUBLIC_PRIVACY_URL} target="_blank" rel="noreferrer">
          Open Public Privacy Policy
        </a>
        <a className="min-h-11 rounded-lg border border-outline-variant px-3 py-3 text-center font-mono text-xs text-primary" href={PUBLIC_DELETE_URL} target="_blank" rel="noreferrer">
          Account Deletion Request
        </a>
      </div>
    </div>
  );
}

function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="font-display text-sm font-bold uppercase tracking-wide">{title}</h3>
      <p className="mt-1 text-on-surface-variant">{children}</p>
    </section>
  );
}
