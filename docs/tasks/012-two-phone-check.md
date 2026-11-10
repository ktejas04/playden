# 012 — Two-phone check and explanations
Phase: 2 (Setup)
Depends on: 011
Touches: docs/explanations/sign-in-and-approval.md, docs/explanations/rooms-and-reconnects.md, docs/plans/02-setup.md, README.md
Spec: docs/plans/02-setup.md#goal

## Steps
1. Manual, on production:
   - Phone A (Wi-Fi, admin) and phone B (mobile data, second Google account) sign in.
   - B fills in the profile and waits; A approves B from `/admin`.
   - A creates a room and shares the link on WhatsApp; B opens it. Both see two players.
   - B locks the phone for 30 s and unlocks it. B reconnects without a tap; A sees B drop and return.
2. Fix anything that breaks (each fix starts with a failing test where possible).
3. Write the two explanation docs: what each part does, how it fits the architecture, and where the code lives.
4. Mark the phase done in the plan and README status.

## Done when
- [ ] Every manual step above works on two real phones on different networks
- [ ] Explanations written
- [ ] pnpm typecheck, lint, test pass
