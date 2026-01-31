const PptxGenJS = require('pptxgenjs');

// Create a new presentation
const pptx = new PptxGenJS();

// Set presentation properties
pptx.author = 'Purchase Requisition System';
pptx.company = 'Organization';
pptx.title = 'Purchase Requisition System Benefits';
pptx.subject = 'System Benefits Presentation';

// Define color scheme
const colors = {
  primary: '0066CC',
  secondary: '4A90E2',
  accent: '2ECC71',
  text: '333333',
  white: 'FFFFFF',
  lightGray: 'F5F5F5'
};

// ========================================
// SLIDE 1: Title Slide
// ========================================
let slide1 = pptx.addSlide();
slide1.background = { color: colors.primary };

slide1.addText('Purchase Requisition System', {
  x: 0.5,
  y: 2.0,
  w: 9,
  h: 1.5,
  fontSize: 44,
  bold: true,
  color: colors.white,
  align: 'center'
});

slide1.addText('Streamline Your Procurement Process', {
  x: 0.5,
  y: 3.5,
  w: 9,
  h: 0.8,
  fontSize: 24,
  color: colors.white,
  align: 'center'
});

slide1.addText('Digital Transformation for Efficient Operations', {
  x: 0.5,
  y: 4.5,
  w: 9,
  h: 0.5,
  fontSize: 16,
  color: colors.white,
  align: 'center',
  italic: true
});

// ========================================
// SLIDE 2: Key Benefits Overview
// ========================================
let slide2 = pptx.addSlide();
slide2.background = { color: colors.white };

slide2.addText('Key Benefits at a Glance', {
  x: 0.5,
  y: 0.5,
  w: 9,
  h: 0.8,
  fontSize: 32,
  bold: true,
  color: colors.primary
});

const benefits = [
  { icon: '⚡', title: 'Speed & Efficiency', desc: 'Reduce requisition processing time by 70%' },
  { icon: '🔍', title: 'Full Transparency', desc: 'Track every requisition from creation to approval' },
  { icon: '✅', title: 'Automated Workflow', desc: 'Smart routing through HOD → Procurement → Finance → MD' },
  { icon: '📊', title: 'Real-Time Analytics', desc: 'Instant insights into spending and budget utilization' },
  { icon: '🔒', title: 'Role-Based Security', desc: 'Secure access controls for each department' },
  { icon: '💰', title: 'Cost Savings', desc: 'Better budget control and vendor management' }
];

let yPos = 1.5;
benefits.forEach((benefit, index) => {
  const xPos = (index % 2 === 0) ? 0.5 : 5.2;
  if (index % 2 === 0 && index > 0) yPos += 1.3;

  slide2.addText(benefit.icon + ' ' + benefit.title, {
    x: xPos,
    y: yPos,
    w: 4.5,
    h: 0.4,
    fontSize: 16,
    bold: true,
    color: colors.primary
  });

  slide2.addText(benefit.desc, {
    x: xPos,
    y: yPos + 0.45,
    w: 4.5,
    h: 0.6,
    fontSize: 12,
    color: colors.text
  });
});

// ========================================
// SLIDE 3: Workflow Automation
// ========================================
let slide3 = pptx.addSlide();
slide3.background = { color: colors.lightGray };

slide3.addText('Automated Approval Workflow', {
  x: 0.5,
  y: 0.5,
  w: 9,
  h: 0.8,
  fontSize: 32,
  bold: true,
  color: colors.primary
});

slide3.addText('From Request to Purchase Order in Minutes, Not Days', {
  x: 0.5,
  y: 1.2,
  w: 9,
  h: 0.4,
  fontSize: 14,
  italic: true,
  color: colors.secondary
});

// Workflow steps
const workflow = [
  { step: '1', role: 'Initiator', action: 'Creates requisition with up to 15 line items' },
  { step: '2', role: 'HOD', action: 'Reviews and approves department request' },
  { step: '3', role: 'Procurement', action: 'Adds pricing, obtains quotes, adjudicates' },
  { step: '4', role: 'Finance', action: 'Verifies budget and approves expenditure' },
  { step: '5', role: 'MD', action: 'Final approval and PO generation' }
];

let workflowY = 2.0;
workflow.forEach((item, index) => {
  // Step number circle
  slide3.addShape(pptx.ShapeType.ellipse, {
    x: 0.8,
    y: workflowY,
    w: 0.5,
    h: 0.5,
    fill: { color: colors.primary },
  });

  slide3.addText(item.step, {
    x: 0.8,
    y: workflowY,
    w: 0.5,
    h: 0.5,
    fontSize: 18,
    bold: true,
    color: colors.white,
    align: 'center',
    valign: 'middle'
  });

  // Role and action
  slide3.addText(item.role, {
    x: 1.5,
    y: workflowY,
    w: 7.5,
    h: 0.25,
    fontSize: 14,
    bold: true,
    color: colors.primary
  });

  slide3.addText(item.action, {
    x: 1.5,
    y: workflowY + 0.25,
    w: 7.5,
    h: 0.25,
    fontSize: 11,
    color: colors.text
  });

  // Arrow (except for last item)
  if (index < workflow.length - 1) {
    slide3.addShape(pptx.ShapeType.rightArrow, {
      x: 0.95,
      y: workflowY + 0.6,
      w: 0.2,
      h: 0.15,
      fill: { color: colors.secondary }
    });
  }

  workflowY += 0.85;
});

// ========================================
// SLIDE 4: Advanced Features
// ========================================
let slide4 = pptx.addSlide();
slide4.background = { color: colors.white };

slide4.addText('Advanced Features', {
  x: 0.5,
  y: 0.5,
  w: 9,
  h: 0.8,
  fontSize: 32,
  bold: true,
  color: colors.primary
});

const features = [
  {
    title: '📝 Multi-Line Items',
    points: [
      'Add up to 15 items per requisition',
      'Independent pricing for each item',
      'Real-time calculation of totals, VAT, and grand total',
      'Role-based pricing: Initiators request, Procurement prices'
    ]
  },
  {
    title: '📄 Professional PDFs',
    points: [
      'Auto-generated requisition and PO documents',
      'Complete itemization with pricing details',
      'VAT calculations at 16%',
      'Ready for formal approvals and record-keeping'
    ]
  },
  {
    title: '💱 Budget & FX Management',
    points: [
      'Multi-currency support (ZMW, USD, EUR, GBP)',
      'Real-time exchange rate tracking',
      'Budget allocation and monitoring',
      'Spending analytics by department'
    ]
  }
];

let featureY = 1.5;
features.forEach((feature, index) => {
  slide4.addText(feature.title, {
    x: 0.5,
    y: featureY,
    w: 9,
    h: 0.4,
    fontSize: 16,
    bold: true,
    color: colors.primary
  });

  feature.points.forEach((point, pIndex) => {
    slide4.addText('• ' + point, {
      x: 0.8,
      y: featureY + 0.45 + (pIndex * 0.25),
      w: 8.5,
      h: 0.25,
      fontSize: 11,
      color: colors.text
    });
  });

  featureY += 1.5;
});

// ========================================
// SLIDE 5: Measurable Impact
// ========================================
let slide5 = pptx.addSlide();
slide5.background = { color: colors.primary };

slide5.addText('Measurable Impact', {
  x: 0.5,
  y: 0.5,
  w: 9,
  h: 0.8,
  fontSize: 32,
  bold: true,
  color: colors.white
});

const impacts = [
  { metric: '70%', description: 'Reduction in Processing Time' },
  { metric: '100%', description: 'Digital Audit Trail' },
  { metric: '24/7', description: 'Access from Anywhere' },
  { metric: '15x', description: 'More Items per Requisition' },
  { metric: '6 Roles', description: 'Complete Role-Based Access' },
  { metric: '0 Paper', description: 'Fully Digital Process' }
];

let impactY = 1.8;
impacts.forEach((impact, index) => {
  const xPos = (index % 3) * 3.3 + 0.5;
  const yPos = Math.floor(index / 3) * 1.8 + impactY;

  // Background box
  slide5.addShape(pptx.ShapeType.rect, {
    x: xPos,
    y: yPos,
    w: 3.0,
    h: 1.4,
    fill: { color: colors.white, transparency: 10 },
    line: { color: colors.white, width: 2 }
  });

  // Metric
  slide5.addText(impact.metric, {
    x: xPos,
    y: yPos + 0.2,
    w: 3.0,
    h: 0.6,
    fontSize: 36,
    bold: true,
    color: colors.accent,
    align: 'center'
  });

  // Description
  slide5.addText(impact.description, {
    x: xPos,
    y: yPos + 0.85,
    w: 3.0,
    h: 0.4,
    fontSize: 12,
    color: colors.white,
    align: 'center'
  });
});

// ========================================
// SLIDE 6: Call to Action
// ========================================
let slide6 = pptx.addSlide();
slide6.background = { color: colors.lightGray };

slide6.addText('Ready to Transform Your Procurement?', {
  x: 0.5,
  y: 1.5,
  w: 9,
  h: 1.0,
  fontSize: 36,
  bold: true,
  color: colors.primary,
  align: 'center'
});

slide6.addShape(pptx.ShapeType.rect, {
  x: 2.0,
  y: 3.0,
  w: 6.0,
  h: 2.0,
  fill: { color: colors.white },
  line: { color: colors.secondary, width: 2 }
});

const benefits_summary = [
  '✅ Eliminate paper-based processes',
  '✅ Reduce approval delays',
  '✅ Improve budget visibility',
  '✅ Enhance vendor management',
  '✅ Ensure compliance and auditability',
  '✅ Empower all stakeholders with real-time access'
];

let summaryY = 3.3;
benefits_summary.forEach((benefit) => {
  slide6.addText(benefit, {
    x: 2.3,
    y: summaryY,
    w: 5.4,
    h: 0.3,
    fontSize: 13,
    color: colors.text,
    bold: true
  });
  summaryY += 0.28;
});

slide6.addText('Start streamlining your procurement today!', {
  x: 0.5,
  y: 5.5,
  w: 9,
  h: 0.6,
  fontSize: 18,
  italic: true,
  color: colors.secondary,
  align: 'center'
});

// Save the presentation
const filename = 'Purchase_Requisition_System_Benefits.pptx';
pptx.writeFile({ fileName: filename })
  .then(() => {
    console.log('\n✅ SUCCESS! Presentation created successfully!');
    console.log(`\n📊 File: ${filename}`);
    console.log('📍 Location: C:\\Projects\\purchase-requisition-system\\');
    console.log('\n📋 Presentation Contains:');
    console.log('   Slide 1: Title Slide');
    console.log('   Slide 2: Key Benefits Overview (6 benefits)');
    console.log('   Slide 3: Automated Approval Workflow (5-step process)');
    console.log('   Slide 4: Advanced Features (Multi-line items, PDFs, Budget/FX)');
    console.log('   Slide 5: Measurable Impact (6 metrics)');
    console.log('   Slide 6: Call to Action');
    console.log('\n💡 You can now open this file in PowerPoint, Google Slides, or any compatible software.\n');
  })
  .catch((err) => {
    console.error('❌ Error creating presentation:', err);
  });
