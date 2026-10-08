import PDFDocument from 'pdfkit'
import { createWriteStream } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'imran-mazhar-resume.pdf')

// ---------- layout constants ----------
const PAGE = { width: 595.28, height: 841.89 } // A4
const MARGIN = 46
const CONTENT_WIDTH = PAGE.width - MARGIN * 2
const RIGHT_EDGE = PAGE.width - MARGIN
const CONTENT_BOTTOM = PAGE.height - MARGIN
const HEADER_HEIGHT = 104

// ---------- palette ----------
const INK = '#0f172a'
const BODY = '#334155'
const MUTED = '#64748b'
const ACCENT = '#dc2626'
const RULE = '#cbd5e1'

// ---------- type scale ----------
const TITLE = 22
const HEADER_LINE = 9.5
const SECTION = 9
const ENTRY_TITLE = 11
const ENTRY_META = 9
const BODY_SIZE = 9
const LINE_GAP = 1.2

const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true })
doc.pipe(createWriteStream(out))

const DEBUG = process.env.DEBUG_LAYOUT === '1'
function trace(label) {
  if (DEBUG) {
    console.log(`${label.padEnd(14)} y=${doc.y.toFixed(1).padStart(6)} pages=${doc.bufferedPageRange().count}`)
  }
}

function sectionTitle(label) {
  doc.moveDown(0.8)
  const top = doc.y
  doc.font('Helvetica-Bold').fontSize(SECTION).fillColor(ACCENT)
  doc.text(label.toUpperCase(), MARGIN, top, { width: CONTENT_WIDTH, characterSpacing: 1.4 })

  const ruleY = doc.y + 3
  doc
    .save()
    .moveTo(MARGIN, ruleY)
    .lineTo(RIGHT_EDGE, ruleY)
    .lineWidth(0.75)
    .strokeColor(RULE)
    .stroke()
    .restore()

  doc.y = ruleY + 10
}

// Hanging-indent bullet: the marker sits in its own gutter, wrapped lines align
// under the text rather than under the marker.
function bullet(text) {
  const y = doc.y
  const gutter = 9
  doc.font('Helvetica').fontSize(BODY_SIZE).fillColor(MUTED)
  doc.text('•', MARGIN, y, { width: gutter, lineBreak: false })
  doc.font('Helvetica').fillColor(BODY)
  doc.text(text, MARGIN + gutter, y, { width: CONTENT_WIDTH - gutter, lineGap: LINE_GAP })
}

// Entry with the date range right-aligned on the title baseline.
function entry({ title, dates, org, bullets = [] }) {
  const y = doc.y
  const metaWidth = CONTENT_WIDTH * 0.3
  const titleWidth = CONTENT_WIDTH - metaWidth

  doc.font('Helvetica-Bold').fontSize(ENTRY_TITLE).fillColor(INK)
  doc.text(title, MARGIN, y, { width: titleWidth, lineGap: 1 })

  const afterTitle = doc.y
  doc.font('Helvetica').fontSize(ENTRY_META).fillColor(ACCENT)
  doc.text(dates, MARGIN + titleWidth, y + 2.5, { width: metaWidth, align: 'right', lineBreak: false })

  doc.y = afterTitle + 1
  doc.font('Helvetica').fillColor(MUTED)
  doc.text(org, MARGIN, doc.y, { width: CONTENT_WIDTH, lineBreak: false })

  if (bullets.length) {
    doc.moveDown(0.4)
    bullets.forEach(bullet)
  }
  doc.moveDown(0.58)
}

// ================= header =================
doc.rect(0, 0, PAGE.width, HEADER_HEIGHT).fill(INK)
doc.rect(0, HEADER_HEIGHT - 3, PAGE.width, 3).fill(ACCENT)

const headTop = 24
doc.font('Helvetica-Bold').fontSize(TITLE).fillColor('#ffffff')
doc.text('IMRAN MAZHAR', MARGIN, headTop, { width: CONTENT_WIDTH, characterSpacing: 0.5 })

doc.font('Helvetica').fontSize(10).fillColor('#cbd5e1')
doc.text('IT Support & Front Desk Operations  ·  B.S. Computer Science', MARGIN, headTop + 29, {
  width: CONTENT_WIDTH,
  lineBreak: false,
})

doc.font('Helvetica').fontSize(HEADER_LINE).fillColor('#94a3b8')
doc.text('heyimran.pdf@gmail.com  ·  +92 321-1396227  ·  github.com/ImranMZ', MARGIN, headTop + 46, {
  width: CONTENT_WIDTH,
  lineBreak: false,
})
doc.text('linkedin.com/in/imran-mazhar-a8a514407  ·  Muzaffargarh, Punjab, Pakistan', MARGIN, headTop + 59, {
  width: CONTENT_WIDTH,
  lineBreak: false,
})

doc.y = HEADER_HEIGHT + 14
trace('header')

// ================= summary =================
doc.font('Helvetica').fontSize(BODY_SIZE).fillColor(BODY)
doc.text(
  'Public Service Assistant in a Punjab Police IT environment since 2023, pairing front desk and IT support duties with a full-time B.S. in Computer Science. Currently focused on cybersecurity fundamentals, networking, and databases.',
  MARGIN,
  doc.y,
  { width: CONTENT_WIDTH, lineGap: LINE_GAP }
)
trace('summary')

// ================= experience =================
sectionTitle('Experience')

entry({
  title: 'Public Service Assistant — Front Desk Officer',
  dates: 'Nov 2023 – Present',
  org: 'Punjab Police · Part-time · Muzaffargarh',
  bullets: [
    'Front desk support for staff and visitors in an IT-enabled office',
    'Data entry and maintenance of internal databases and records',
    'Report preparation, verification, and processing for daily operations',
    'Monitoring computer systems and escalating issues for timely resolution',
    'Day-to-day IT operations and basic troubleshooting',
  ],
})

entry({
  title: 'Computer Operator',
  dates: '2019 – 2023',
  org: 'National News Agency · Muzaffargarh',
  bullets: ['Data entry, document processing, and office computer support'],
})
trace('experience')

// ================= education =================
sectionTitle('Education')

entry({
  title: 'Bachelor of Computer Science (BSCS)',
  dates: 'Nov 2024 – Nov 2028',
  org: 'Multan University of Science and Technology · Expected 2028',
  bullets: [
    'Coursework: Programming Fundamentals, OOP, Data Structures, Database Systems',
    'Member, Information and Computer Sciences Society; university coding competitions',
    'Workshops in Python and web development',
  ],
})

entry({
  title: 'Intermediate in Computer Science',
  dates: '2020 – 2022',
  org: 'Govt. Graduate College',
})
trace('education')

// ================= projects =================
sectionTitle('Projects')

const projects = [
  ['MUST Portal Redesign', 'React · Vite · TypeScript', 'Three-console redesign of the MultanUST university portal for student, admin, and faculty workflows.'],
  ['Web Counter Monitor', 'JavaScript · Chrome MV3', 'Chrome extension that watches a counter on any page and alerts the instant it changes.'],
  ['JobHive AI', 'JavaScript · AI', 'AI job aggregator with smart matching, cover letters, interview coaching, and skill-gap analysis.'],
  ['Student Record System', 'C++', 'Console semester project for student records, built on data structures and OOP fundamentals.'],
]

projects.forEach(([title, stack, description]) => {
  const y = doc.y
  const stackWidth = CONTENT_WIDTH * 0.3
  const titleWidth = CONTENT_WIDTH - stackWidth

  doc.font('Helvetica-Bold').fontSize(ENTRY_TITLE).fillColor(INK)
  doc.text(title, MARGIN, y, { width: titleWidth, lineGap: 1 })

  const afterTitle = doc.y
  doc.font('Helvetica').fontSize(ENTRY_META).fillColor(ACCENT)
  doc.text(stack, MARGIN + titleWidth, y + 2.5, { width: stackWidth, align: 'right', lineBreak: false })

  doc.y = afterTitle + 1
  doc.font('Helvetica').fillColor(BODY)
  doc.text(description, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: LINE_GAP })
  doc.moveDown(0.46)
})
trace('projects')

// ================= skills =================
sectionTitle('Skills')

const skillGroups = [
  ['Languages', 'C, C++, JavaScript, Python'],
  ['Frontend', 'React, Vite, TypeScript'],
  ['Tools', 'Git, GitHub, VS Code, Microsoft Office, Chrome DevTools'],
  ['Practices', 'IT support & troubleshooting, database systems, data entry & records, networking fundamentals'],
]

skillGroups.forEach(([label, items]) => {
  const y = doc.y
  const labelWidth = 62
  doc.font('Helvetica-Bold').fontSize(BODY_SIZE).fillColor(INK)
  doc.text(label, MARGIN, y, { width: labelWidth, lineBreak: false })
  doc.font('Helvetica').fillColor(BODY)
  doc.text(items, MARGIN + labelWidth + 6, y, { width: CONTENT_WIDTH - labelWidth - 6, lineGap: LINE_GAP })
  doc.moveDown(0.3)
})
trace('skills')

// ================= certifications =================
sectionTitle('Certifications')

const certs = [
  ['AI Fluency Framework & Foundations', 'Anthropic', 'Aug 2026'],
  ['Generative AI Skill', 'Google Cloud Skills Boost', 'May 2024'],
  ['Networking Essentials', 'Cisco', 'Dec 2022'],
  ['Cybersecurity Essentials', 'Cisco', 'Oct 2022'],
]

certs.forEach(([name, org, date]) => {
  const y = doc.y
  const dateWidth = 52
  const orgWidth = 150
  doc.font('Helvetica-Bold').fontSize(BODY_SIZE).fillColor(INK)
  doc.text(name, MARGIN, y, { width: CONTENT_WIDTH - dateWidth - orgWidth - 12, lineBreak: false })
  doc.font('Helvetica').fillColor(MUTED)
  doc.text(org, MARGIN + CONTENT_WIDTH - dateWidth - orgWidth, y, {
    width: orgWidth,
    align: 'right',
    lineBreak: false,
  })
  doc.text(date, MARGIN + CONTENT_WIDTH - dateWidth, y, { width: dateWidth, align: 'right', lineBreak: false })
  doc.moveDown(0.3)
})
trace('certs')

// ================= footer =================
// Writing below the bottom margin makes pdfkit spawn a new page, so the bottom
// margin is lifted to zero while the footer is drawn, then restored.
const range = doc.bufferedPageRange()
const savedBottom = doc.page.margins.bottom
for (let i = range.start; i < range.start + range.count; i += 1) {
  doc.switchToPage(i)
  doc.page.margins.bottom = 0
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
  doc.text('imranmz.github.io', MARGIN, PAGE.height - 30, { width: CONTENT_WIDTH / 2, lineBreak: false })
  doc.text(`Page ${i + range.start + 1} of ${range.count}`, MARGIN + CONTENT_WIDTH / 2, PAGE.height - 30, {
    width: CONTENT_WIDTH / 2,
    align: 'right',
    lineBreak: false,
  })
  doc.page.margins.bottom = savedBottom
}

const pages = range.count
doc.on('finish', () => {
  console.log(`wrote ${out} — ${pages} page${pages === 1 ? '' : 's'}`)
  if (pages > 1) {
    console.warn('WARNING: CV spills onto a second page — trim content or spacing.')
    process.exitCode = 1
  }
})

doc.end()