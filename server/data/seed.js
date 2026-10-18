// Realistic demo data so the dashboard looks populated on first run.
const now = Date.now();
const ago = (hours) => new Date(now - hours * 3600_000).toISOString();
const ahead = (hours) => new Date(now + hours * 3600_000).toISOString();

export const seedSettings = {
  institute: {
    name: 'Apex Learning Institute',
    phone: '+91 98765 00000',
    address: 'Model Town, Ludhiana, Punjab',
    website: 'https://example.com',
    instagram: '@apexlearning',
    whatsapp: '+91 98765 00000',
  },
  courses: [
    { id: 'c_jee', name: 'JEE', class: '11-12', description: 'Integrated JEE Main and Advanced preparation.' },
    { id: 'c_neet', name: 'NEET', class: '11-12', description: 'Biology, Physics and Chemistry for NEET.' },
    { id: 'c_foundation', name: 'Foundation', class: '8-10', description: 'Strong base in Maths and Science.' },
  ],
  // Only information saved here may be used by the AI. Empty fields mean unknown.
  aiKnowledge: {
    JEE: { duration: '', batchTimings: '', fee: '', location: '', demoAvailability: '' },
    NEET: { duration: '', batchTimings: '', fee: '', location: '', demoAvailability: '' },
    Foundation: { duration: '', batchTimings: '', fee: '', location: '', demoAvailability: '' },
  },
};

// Each lead: [name, phone, class, course, source, status, temperature, category, intent, hoursAgo, messages]
// messages: [sender, text, hoursAgo]
const LEADS = [
  ['Aarav Sharma', '9876543210', '12', 'JEE', 'Instagram', 'new', 'hot', 'fees', 'JEE fee enquiry', 0.05,
    [['student', 'Sir JEE batch kab start hoga aur fees kitni hai?', 0.05]]],
  ['Ananya Singh', '9123456780', '12', 'NEET', 'WhatsApp', 'contacted', 'warm', 'batches', 'Weekend batch availability', 0.25,
    [['student', 'Do you have weekend batches for NEET?', 0.25],
     ['staff', 'Yes, we run weekend batches. Let me confirm the timings and share them with you.', 0.2]]],
  ['Rahul Mehta', '9988776655', '11', 'JEE', 'Phone', 'contacted', 'warm', 'location', 'Institute location', 1,
    [['student', 'Location kahan hai?', 1]]],
  ['Priya Kaur', '9871234560', '10', 'Foundation', 'Website', 'new', 'cold', 'general', 'General foundation course enquiry', 3,
    [['student', 'Hi, I want info about your foundation course.', 3]]],
  ['Karan Verma', '9812345678', '12', 'JEE', 'Instagram', 'interested', 'hot', 'demo', 'Demo class request', 5,
    [['student', 'Can I attend a demo class before joining?', 5],
     ['staff', 'Absolutely. Which day suits you for the demo?', 4],
     ['student', 'Saturday would be good.', 3]]],
  ['Sneha Patel', '9900112233', '12', 'NEET', 'Manual', 'follow-up', 'warm', 'fees', 'NEET fee structure', 26,
    [['student', 'NEET ki fees kitni hai?', 26],
     ['staff', 'Let me check the current fee details for you.', 25]]],
  ['Ishaan Gupta', '9955667788', '11', 'NEET', 'WhatsApp', 'converted', 'hot', 'admissions', 'Admission process', 48,
    [['student', 'How do I take admission?', 48],
     ['staff', 'Happy to help. Please visit the office or we can share the form.', 47]]],
  ['Meera Joshi', '9811223344', '9', 'Foundation', 'Instagram', 'new', 'warm', 'timings', 'Batch timings query', 2,
    [['student', 'Foundation batch ka timing kya hai?', 2]]],
  ['Vikram Rao', '9877001122', '12', 'JEE', 'Phone', 'lost', 'cold', 'courses', 'Asked about courses', 120,
    [['student', 'What courses do you offer?', 120]]],
  ['Simran Kaur', '9822334455', '10', 'Foundation', 'Website', 'new', 'hot', 'admissions', 'Wants to enrol this session', 0.5,
    [['student', 'I want to enrol my son for the session starting next month.', 0.5]]],
  ['Arjun Nair', '9866554433', '12', 'NEET', 'Instagram', 'contacted', 'warm', 'results', 'Previous batch results', 10,
    [['student', 'What are your past NEET results?', 10]]],
  ['Tanvi Malhotra', '9845612378', '11', 'JEE', 'WhatsApp', 'interested', 'hot', 'fees', 'JEE fee and EMI options', 7,
    [['student', 'Is there an EMI option for JEE fees?', 7]]],
  ['Dev Bhatia', '9800998877', '8', 'Foundation', 'Manual', 'new', 'cold', 'spam', 'Promotional message', 30,
    [['student', 'Buy cheap followers now!!!', 30]]],
  ['Riya Chopra', '9833221100', '12', 'NEET', 'Phone', 'follow-up', 'warm', 'faculty', 'Faculty details', 9,
    [['student', 'Who teaches Biology in the NEET batch?', 9]]],
  ['Yash Agarwal', '9899887766', '12', 'JEE', 'Instagram', 'contacted', 'cold', 'general', 'General query', 60,
    [['student', 'Hello, just checking details.', 60]]],
];

export function buildSeed() {
  const leads = [];
  const messages = [];
  let msgNo = 1;
  LEADS.forEach(([name, phone, cls, course, source, status, temperature, category, intent, hoursAgo, msgs], i) => {
    const id = `lead_${String(i + 1).padStart(3, '0')}`;
    const createdAt = ago(msgs[0][2]);
    leads.push({
      id, name, phone, email: '', class: cls, course, source, status, temperature, category, intent,
      createdAt,
      lastContactedAt: msgs.some(([s]) => s === 'staff') ? ago(hoursAgo) : null,
      nextFollowUpAt: null,
    });
    for (const [sender, text, hrs] of msgs) {
      messages.push({ id: `msg_${String(msgNo++).padStart(3, '0')}`, leadId: id, sender, text, timestamp: ago(hrs) });
    }
  });

  const followups = [
    { id: 'fu_001', leadId: 'lead_001', scheduledFor: ahead(24), reason: 'Fee enquiry follow-up', status: 'pending' },
    { id: 'fu_002', leadId: 'lead_005', scheduledFor: ahead(0.2), reason: 'Confirm demo slot', status: 'pending' },
    { id: 'fu_003', leadId: 'lead_002', scheduledFor: ahead(4), reason: 'Share weekend timings', status: 'pending' },
    { id: 'fu_004', leadId: 'lead_012', scheduledFor: ago(2), reason: 'EMI details', status: 'pending' },
    { id: 'fu_005', leadId: 'lead_014', scheduledFor: ago(720), reason: 'Faculty details sent', status: 'completed' },
  ];

  return { leads, messages, followups, settings: seedSettings };
}
