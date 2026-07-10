# CRN — UAT Walkthrough for Alex (July 2026)

Work through these with the app after the July update lands. Tick the box when it works,
and jot anything that feels wrong in the Notes line — even small stuff ("too many clicks",
"wrong wording") is exactly what we want to hear.

## 1. Schedule (Jobs & Payments)

- [ ] Open Jobs & Payments. The month is now split into **week sections** with a header bar
      (jobs done count + revenue for the week). Weeks that are already over start collapsed.
- [ ] Tap a collapsed week header — it expands; tap again — it collapses.
- [ ] Is this enough to fix "the schedule line is too long", or would you also want
      day-by-day collapsing / a compact list? Notes: ____________

## 2. Who owes me money

- [ ] Open Invoices. At the top there's an **Outstanding by Owner** panel. For each owner it
      shows: *Invoiced & unpaid* (bills you've sent that haven't been paid) and *Unbilled work*
      (finished cleans never put on any invoice), plus the total.
- [ ] **LTL check**: you believed LTL owes about **$1,400**. Find LTL's row. Does the total
      match your number? If not, click into the detail — is the difference *unbilled work*
      (jobs never invoiced) or *unpaid invoices*? Notes: ____________
- [ ] Do the "since &lt;date&gt;" hints look right (oldest unpaid invoice / oldest unbilled job)?

## 3. Billing an account in one go (the Amazwi flow)

- [ ] On the Outstanding panel, press **Bill outstanding** next to Amazwi.
- [ ] A new invoice opens with **every unbilled job across all Amazwi properties already
      selected**, grouped by property, extra charges included. Deselect anything you don't
      want billed yet.
- [ ] The billing-period label is free text — change it to how you say it, e.g.
      "Jun 22 – Jul 5, 2026". Nothing forces calendar months anymore.
- [ ] Create the invoice, then use **Print / Save as PDF** to make the document you send her.
- [ ] Honesty note: the button that used to say "Send Email" is now **Mark as Sent** — the app
      never actually emailed anyone, so now it just records that *you* delivered it. Does that
      match how you want to work, or do you want real emailing built? Notes: ____________

## 4. Recording payments

- [ ] When a payment comes in covering several invoices: on the Invoices list, tick the
      checkboxes for all of them → **Mark as Paid** → set the paid date and how they paid
      (check / Venmo / Zelle / ACH / cash) → confirm. All of them flip to Paid at once.
- [ ] Spot-check one job from a paid invoice — its "client paid" flag should now be set too.
- [ ] Is invoice-level paid/unpaid enough, or do you also need **partial payments**
      ("she paid $500 of the $1,400")? That's not built yet — tell us if you need it.
      Notes: ____________

## 5. Reports (these were showing wrong numbers before — please re-judge them)

- [ ] **P&L**: profit now subtracts what you pay the team and mileage (it didn't before, so
      profit looked much bigger than reality). Does this month look believable now?
- [ ] **Revenue by property**: House Cut column shows dollar amounts (was $NaN).
- [ ] **Revenue by job type / by owner**: real names instead of "Unknown".
- [ ] **Schedule C / Tax tab**: the table has lines in it now, and "Est. SE Tax" is a
      reasonable ~15% of profit (it used to show your entire profit).
- [ ] **Who owes me (A/R aging)**: invoices now age from their **due date** (based on payment
      terms), not the day you created them. Do the buckets look right?
- [ ] Do numbers agree with each other across tabs (e.g. revenue on P&L vs Revenue tab)?

## 6. Everyday admin (these were silently broken — first time they'll actually work)

- [ ] **Expenses** page loads, and **Add Expense** with a category actually saves.
- [ ] **Pay periods**: you can **Close** a period. Before closing, the preview now also
      includes older finished jobs that earlier closes missed — the total may be *bigger*
      than you expect the first time. Check the job list before you confirm.
- [ ] **Owners**: open an owner, edit their details, save. (Never worked before.)
- [ ] **Settings**: change something (e.g. phone number), save, reload — it sticks.
      (Never worked before.)

## 7. Anything else

- [ ] What's the next most annoying thing we haven't touched? ____________
