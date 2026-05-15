# Database Changes

Pending changes to be applied to the production database and Lambda function.

---

## 1. New columns on `leads` table

### schema.sql — ALTER TABLE

```sql
ALTER TABLE leads
  ADD COLUMN cpf_ma       DECIMAL(12,2) AFTER cpf_sa,
  ADD COLUMN bank_balance DECIMAL(12,2) AFTER cpf_ma;
```

These columns support the two new Financial Portfolio fields added to the client profile:
- `cpf_ma` — CPF Medisave Account balance
- `bank_balance` — Total bank savings

---

## 2. Lambda PUT /leads/{id} handler

### lambda/index.mjs — UPDATE query

Add the two new columns to the `UPDATE leads SET` statement and its parameter array.

**In the SET clause**, after `cpf_sa = COALESCE(?, cpf_sa),` add:

```sql
cpf_ma          = COALESCE(?, cpf_ma),
bank_balance    = COALESCE(?, bank_balance),
```

**In the parameter array**, after `b.cpf_sa,` add:

```js
b.cpf_ma, b.bank_balance,
```

Full updated block for reference:

```js
await pool.query(
  `UPDATE leads SET
     name            = COALESCE(?, name),
     age             = COALESCE(?, age),
     contact         = COALESCE(?, contact),
     email           = COALESCE(?, email),
     meet_date       = COALESCE(?, meet_date),
     location        = COALESCE(?, location),
     meet_type       = COALESCE(?, meet_type),
     urgency         = COALESCE(?, urgency),
     stage           = COALESCE(?, stage),
     remarks         = COALESCE(?, remarks),
     plan_type       = COALESCE(?, plan_type),
     annual_premium  = COALESCE(?, annual_premium),
     commission_type = COALESCE(?, commission_type),
     cpf_oa          = COALESCE(?, cpf_oa),
     cpf_sa          = COALESCE(?, cpf_sa),
     cpf_ma          = COALESCE(?, cpf_ma),
     bank_balance    = COALESCE(?, bank_balance),
     occupation      = COALESCE(?, occupation),
     income          = COALESCE(?, income),
     referred_by     = COALESCE(?, referred_by),
     extra           = COALESCE(?, extra)
   WHERE lead_id = ?`,
  [
    b.name, b.age, b.contact, b.email, b.meet_date, b.location,
    b.meet_type, b.urgency, b.stage, b.remarks, b.plan_type,
    b.annual_premium, b.commission_type, b.cpf_oa, b.cpf_sa,
    b.cpf_ma, b.bank_balance,
    b.occupation, b.income, b.referred_by, extra, leadId,
  ]
);
```

---

## Notes

- `proposedPlans` (array of proposed insurance plans) is currently stored in the `extra` JSON column via the frontend's localStorage sync — no additional column is needed for that feature.
- The frontend (`backend/api.js` `mapLead`) already maps `cpf_ma → cpfMA` and `bank_balance → bankBalance` once these columns exist.
