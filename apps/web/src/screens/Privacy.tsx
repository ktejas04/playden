import type { ReactNode } from "react";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 text-muted-foreground">{children}</div>
    </section>
  );
}

/** Plain-language privacy policy. Google asks for one before the sign-in app can be published. */
export function Privacy() {
  return (
    <article className="flex max-w-prose flex-col gap-8 pt-3 pb-16">
      <div>
        <h1 className="text-[2rem] leading-tight font-bold tracking-tight">Privacy</h1>
        <p className="mt-1.5 text-muted-foreground">
          PlayDen is a private, invite-only game site for one community. It's free, has no ads, and
          never sells or shares your data.
        </p>
      </div>

      <Section title="What we keep">
        <p>
          When you sign in with Google we receive your Google account ID and email address. You also
          give us a display name and who invited you. We store these, plus whether an admin has
          approved you, so we know who may play.
        </p>
        <p>
          We don't receive or store your Google password, contacts, photos or anything else from
          your Google account.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          We use one cookie to keep you signed in, for up to 30 days. It holds a random code, not
          your details. There are no tracking or advertising cookies. Your theme choice (light or
          dark) is saved on your device only.
        </p>
      </Section>

      <Section title="Who can see it">
        <p>
          Other players see your display name in rooms. Admins see your name, email and who invited
          you so they can approve members. Nobody outside PlayDen sees any of it.
        </p>
        <p>
          The site runs on Cloudflare, which stores the data for us. Games in progress live only in
          memory and are gone shortly after a room closes.
        </p>
      </Section>

      <Section title="Removing your data">
        <p>
          Ask an admin in the group and they'll delete your account and everything stored about you.
        </p>
      </Section>
    </article>
  );
}
