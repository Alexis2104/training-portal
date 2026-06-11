/**
 * Seed script — populates the database with sample data for Acme Corp.
 *
 * Run once after installation:
 *   npm run seed
 *
 * Credentials are read from environment variables (see .env.example).
 * Change all passwords after the first login.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./init');

const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    || 'admin@acme-corp.example';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin1234!';
const USER_PASSWORD  = process.env.SEED_USER_PASSWORD  || 'Sample1234';

const { count } = db.prepare('SELECT COUNT(*) as count FROM departments').get();
if (count > 0) {
  console.log('ℹ️  Database already has data — skipping seed. Delete data/training.db to reseed.');
  process.exit(0);
}

// ── Departments ──────────────────────────────────────────────────────────────
const depts = [
  ['Logistics',       '#C13A2A', 'log'],
  ['Administration',  '#1A3C5E', 'adm'],
  ['Accounting',      '#1A6B5A', 'con'],
  ['Sales',           '#C47B1A', 'ven'],
];
const insD = db.prepare('INSERT INTO departments (name, color, class) VALUES (?, ?, ?)');
depts.forEach(d => insD.run(...d));

// ── Roles ─────────────────────────────────────────────────────────────────────
const roles = [
  ['Logistics Coordinator',    1, 1],
  ['Logistics Operative',      1, 2],
  ['Administrative Manager',   2, 1],
  ['Administrative Assistant', 2, 2],
  ['Senior Accountant',        3, 1],
  ['Junior Accountant',        3, 2],
  ['Sales Manager',            4, 1],
  ['Sales Advisor',            4, 2],
];
const insR = db.prepare('INSERT INTO roles (name, department_id, level) VALUES (?, ?, ?)');
roles.forEach(r => insR.run(...r));

// ── Admin user ────────────────────────────────────────────────────────────────
db.prepare('INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, 1)')
  .run('Admin', ADMIN_EMAIL, bcrypt.hashSync(ADMIN_PASSWORD, 10));

// ── Sample users ──────────────────────────────────────────────────────────────
// role_id matches the roles array above (1-indexed)
const userHash = bcrypt.hashSync(USER_PASSWORD, 10);
const users = [
  ['Alice Johnson',  'alice@acme-corp.example',   userHash, 7],  // Sales Manager
  ['Bob Smith',      'bob@acme-corp.example',      userHash, 8],  // Sales Advisor
  ['Carol Williams', 'carol@acme-corp.example',    userHash, 8],  // Sales Advisor
  ['David Brown',    'david@acme-corp.example',    userHash, 8],  // Sales Advisor
  ['Emma Davis',     'emma@acme-corp.example',     userHash, 8],  // Sales Advisor
  ['Frank Miller',   'frank@acme-corp.example',    userHash, 1],  // Logistics Coordinator
  ['Grace Wilson',   'grace@acme-corp.example',    userHash, 4],  // Administrative Assistant
  ['Henry Moore',    'henry@acme-corp.example',    userHash, 4],  // Administrative Assistant
  ['Iris Taylor',    'iris@acme-corp.example',     userHash, 5],  // Senior Accountant
  ['Jack Anderson',  'jack@acme-corp.example',     userHash, 6],  // Junior Accountant
];
const insU = db.prepare('INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)');
users.forEach(u => insU.run(...u));

// ── Sample modules ────────────────────────────────────────────────────────────
const stepsCancel = JSON.stringify([
  'Check whether the order has an active invoice or shipping label.',
  'If neither exists: open the "Cancel Order" section from the panel.',
  'Select the cancellation reason from the dropdown menu.',
  'If the reason is not listed, choose "Other" and provide details in the text field.',
  'Confirm the cancellation using the confirmation button.',
]);

const stepsModify = JSON.stringify([
  'Verify the order has no active invoice or shipping label.',
  'If it has either: coordinate with Accounting (invoice) or Logistics (shipping label) to release it first.',
  'Open the "Modify Order" section from the panel.',
  'Update the required fields: products, shipping address, payment method, or customer details.',
  'Save the changes and confirm they are correctly reflected in the order.',
]);

const modules = [
  // title, description, dept_id, video_url, duration_minutes, steps
  [
    'How to Process an Order Cancellation',
    'When and how to cancel an order, which cancellation reasons to use, and how to coordinate with other teams when an invoice or shipping label is active.',
    1, /* Logistics */
    // Replace VIDEO_ID with your actual YouTube video ID
    'https://www.youtube.com/embed/VIDEO_ID',
    5,
    stepsCancel,
  ],
  [
    'How to Modify an Existing Order',
    'How to edit products, shipping details, or payment method on an order, and when to request help from Logistics or Accounting.',
    1, /* Logistics */
    'https://www.youtube.com/embed/VIDEO_ID',
    5,
    stepsModify,
  ],
  [
    'Managing Shipping Labels',
    'Complete process for generating, cancelling, and reactivating shipping labels.',
    1, /* Logistics */
    'https://www.youtube.com/embed/VIDEO_ID',
    8,
    '[]',
  ],
  [
    'Creating a New Sales Order',
    'End-to-end flow for creating a new order from the sales panel.',
    4, /* Sales */
    'https://www.youtube.com/embed/VIDEO_ID',
    6,
    '[]',
  ],
];
const insM = db.prepare('INSERT INTO modules (title, description, department_id, video_url, duration_minutes, steps) VALUES (?, ?, ?, ?, ?, ?)');
modules.forEach(m => insM.run(...m));

// ── Module assignments ────────────────────────────────────────────────────────
// [module_id, role_id, is_required]
const assignments = [
  [1, 8, 1], [1, 1, 1], [1, 7, 0],  // Cancel Order: Sales Advisor (req), Logistics Coord (req), Sales Mgr (opt)
  [2, 8, 1], [2, 1, 1], [2, 7, 0],  // Modify Order: same
  [3, 1, 1], [3, 2, 1],              // Shipping Labels: Logistics Coordinator + Operative
  [4, 8, 1], [4, 7, 1],             // New Sales Order: Sales Advisor + Sales Manager
];
const insA = db.prepare('INSERT OR IGNORE INTO module_assignments (module_id, role_id, is_required) VALUES (?, ?, ?)');
assignments.forEach(a => insA.run(...a));

// ── Quiz questions ────────────────────────────────────────────────────────────
const insQ = db.prepare('INSERT INTO quiz_questions (module_id, question, options, correct_answer) VALUES (?, ?, ?, ?)');
[
  // Module 1: How to Process an Order Cancellation
  [1,
    'Can you cancel an order directly if it already has an active shipping label?',
    JSON.stringify([
      'Yes, from the panel without any restrictions',
      'No, you must first coordinate with Logistics to cancel the shipping label',
      'Only if the order total is below $500',
      'Yes, but you need manager approval',
    ]), 1],
  [1,
    'What should you do if the cancellation reason is not in the dropdown list?',
    JSON.stringify([
      'Leave the field blank and proceed',
      'Select the closest available reason',
      'Choose "Other" and type the details in the text field',
      'Contact the system administrator',
    ]), 2],
  [1,
    'If the order has already been invoiced, which department must you coordinate with first?',
    JSON.stringify(['Logistics', 'Administration', 'Sales', 'Accounting']), 3],

  // Module 2: How to Modify an Existing Order
  [2,
    'Can you change the delivery address of an order that already has an active invoice?',
    JSON.stringify([
      'Yes, without any restrictions',
      'No, Accounting must first cancel the invoice',
      'Only if the customer authorises it in writing',
      'Yes, but only the address — nothing else',
    ]), 1],
  [2,
    'Which department must release the shipping label before you can modify the order?',
    JSON.stringify(['Accounting', 'Administration', 'Logistics', 'Sales']), 2],
  [2,
    'Which fields can you modify on an order that has no shipping label or invoice?',
    JSON.stringify([
      'Only products and quantities',
      'Only shipping details',
      'Only the payment method',
      'All fields of the order',
    ]), 3],
].forEach(q => insQ.run(...q));

// ── Sample progress ───────────────────────────────────────────────────────────
// user_id 2 = Alice Johnson, user_id 5 = Emma Davis, etc. (1-indexed, admin is id=1)
const insP = db.prepare('INSERT OR IGNORE INTO progress (user_id, module_id, status, quiz_score, completed_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)');
insP.run(2, 4, 'completed', 100);  // Alice — Creating a New Sales Order
insP.run(5, 4, 'completed', 100);  // Emma  — Creating a New Sales Order
insP.run(7, 3, 'completed', 100);  // Frank — Managing Shipping Labels
insP.run(8, 3, 'completed', 100);  // Grace — Managing Shipping Labels

console.log('✅ Database seeded with Acme Corp sample data.');
console.log(`   Admin:       ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
console.log(`   Sample users @acme-corp.example / ${USER_PASSWORD}`);
console.log('   ⚠️  Change all passwords after your first login.');
