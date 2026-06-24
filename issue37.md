## Description
The architecture states borrowers **"repay the 70% loan over time in USDC"** (ARCHITECTURE.md §End-to-End Flow). Currently the lending pool accepts any repayment amount at any time with no schedule enforcement. A production protocol needs structured repayment tracking with due dates, grace periods, and late payment penalties.

**Branch:** `feat/repayment-schedule`

**Example commits:**
- `feat(lending-pool): add RepaymentSchedule struct with monthly installments`
- `feat(lending-pool): implement grace period and late penalty calculation`
- `test(lending-pool): verify on-time, grace period, and late repayment scenarios`

## Scope & Tasks
1. **Schedule Model (`types.rs`):** Add `RepaymentSchedule` with:
   * `monthly_amount: i128` — calculated as `total_owed / duration_months`.
   * `duration_months: u32` — loan repayment term.
   * `next_due_ledger: u32` — ledger sequence for the next payment due date.
   * `payments_made: u32` — count of on-time payments.
   * `payments_missed: u32` — count of missed payments.
2. **Schedule Creation:** When a loan is approved, automatically generate the repayment schedule based on principal + interest divided over the term.
3. **Grace Period:** Allow a 7-day grace period (~120,960 ledgers) after each due date before marking a payment as missed.
4. **Late Penalty:** If payment is made after the grace period, apply an additional late fee (e.g., 50 bps of the overdue amount).
5. **Default Detection:** After 3 consecutive missed payments, automatically transition loan status to `Defaulted`.
6. **Query:** `get_repayment_schedule(loan_id)` returns the full schedule with status per installment.

## Acceptance Criteria
- [ ] Repayment schedule is auto-generated on loan approval
- [ ] On-time payments update the schedule correctly
- [ ] Grace period payments are accepted without penalty
- [ ] Late payments (after grace) include the penalty fee
- [ ] 3 missed payments trigger `Defaulted` status