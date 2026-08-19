/* ================= HELP / GETTING STARTED =================
   Embeds a condensed version of HANDBOOK_EN.md / HANDBOOK_TA.md in-app.
   Content is keyed by language code (not an isEnglish ? x : y ternary)
   so a third language is "add one more key per section," not a rewrite —
   see the multi-language-ui-design skill this follows. */

let helpLang = localStorage.getItem('pilk_help_lang') || 'en';

const HELP_SECTIONS = [
  {
    id: 'what',
    icon: '❓',
    en: {
      title: 'What is this?',
      body: [
        'One system that runs the whole shop: ringing up sales, tracking stock, recording what customers and vendors owe, and showing you exactly how the business is doing — all updated the instant something happens.',
        'It’s better than paper or a spreadsheet because stock, balances, and profit update themselves instead of needing to be counted or added up by hand, and every void or correction is permanently logged instead of just scratched out.'
      ]
    },
    ta: {
      title: 'இது என்ன?',
      body: [
        'கடையை முழுவதுமாக நடத்தும் ஒரே நிரல்: விற்பனை, சரக்கு கணக்கு, நிலுவைத் தொகைகள், லாபம் — எல்லாம் உடனடியாகப் பதிவாகும்.',
        'காகிதத்தை விட சிறந்தது — சரக்கு, நிலுவை, லாபம் அனைத்தும் தானாகப் புதுப்பிக்கப்படும்; ரத்துசெய்யப்பட்டதும் நிரந்தரமாகப் பதிவாகும், யாராலும் மறைக்க முடியாது.'
      ]
    }
  },
  {
    id: 'do',
    icon: '✅',
    en: {
      title: 'What can it do?',
      body: [
        'Ring up sales (Sell), track stock and vendors (Products, GRN, Vendors), manage customer credit (Customers), record loans and expenses, message customers on WhatsApp, and see profit and reports automatically (Home, Reports).',
        'Two access levels: Admin (everything, including Settings and Reports) and Staff (day-to-day work only) — so pricing and financial data stay protected.'
      ]
    },
    ta: {
      title: 'இது என்ன செய்யும்?',
      body: [
        'விற்பனை (Sell), சரக்கு/வழங்குநர் (Products, GRN, Vendors), வாடிக்கையாளர் கடன் (Customers), கடன்கள்/செலவுகள், WhatsApp செய்திகள், லாபம்/அறிக்கைகள் (Home, Reports).',
        'இரண்டு அணுகல் நிலைகள்: Admin (அனைத்தும் — Settings, Reports உட்பட) மற்றும் Staff (அன்றாட வேலை மட்டும்) — விலை/நிதி தரவு பாதுகாப்பாக இருக்க.'
      ]
    }
  },
  {
    id: 'screens',
    icon: '🗺️',
    en: {
      title: 'Quick screen guide',
      body: [
        '🧾 Sell — ring up a sale. This is the screen you’ll use most.',
        '🏠 Home — today’s numbers at a glance, and Ask AI for quick questions.',
        '📦 Products — the master list of what the shop sells.',
        '📥 GRN — record new stock arriving from a vendor.',
        '📜 Bills — every past sale; reprint, duplicate, or void one.',
        '👥 Customers — balances, purchase history, WhatsApp.',
        '🚚 Vendors — what the shop owes suppliers.',
        '💰 Loans — borrowed money and repayments.',
        '💸 Expenses — day-to-day costs.',
        '💬 Messages — WhatsApp conversation log.',
        '📊 Reports — exportable numbers (Admin only).',
        '⚙️ Settings — shop configuration (Admin only).',
        'Full detail on every button: see the complete handbook, linked below.'
      ]
    },
    ta: {
      title: 'திரை வழிகாட்டி (சுருக்கம்)',
      body: [
        '🧾 Sell — பில் போடுவது. அதிகம் பயன்படுத்தும் திரை.',
        '🏠 Home — இன்றைய எண்கள், Ask AI.',
        '📦 Products — பொருட்கள் பட்டியல்.',
        '📥 GRN — புதிய சரக்கு வரவு பதிவு.',
        '📜 Bills — முந்தைய பில்கள்.',
        '👥 Customers — வாடிக்கையாளர் நிலுவை.',
        '🚚 Vendors — வழங்குநர் நிலுவை.',
        '💰 Loans — கடன்கள்.',
        '💸 Expenses — செலவுகள்.',
        '💬 Messages — WhatsApp பதிவு.',
        '📊 Reports — அறிக்கைகள் (Admin).',
        '⚙️ Settings — அமைப்புகள் (Admin).',
        'முழு விவரம்: கீழே உள்ள முழு கையேடு இணைப்பைப் பார்க்கவும்.'
      ]
    }
  },
  {
    id: 'coming',
    icon: '🚧',
    en: {
      title: 'Coming soon',
      body: [
        'Barcode scanning at checkout, splitting a sale between cash and card, an end-of-day till-reconciliation report, remote login from outside the shop WiFi, offline sale capture with auto-sync, and the 15-question setup wizard for new accounts.',
        'These are being actively built. This Help screen and the full handbook will be updated with real instructions the moment each one works — not before.'
      ]
    },
    ta: {
      title: 'விரைவில் வரும்',
      body: [
        'பில்லிங்கில் Barcode ஸ்கேன், cash+card பிரித்துச் செலுத்துதல், நாள் முடிவு காசு சரிபார்ப்பு அறிக்கை, கடைக்கு வெளியே இருந்து லாகின், offline விற்பனை + auto-sync, புதிய கணக்குகளுக்கான 15-கேள்வி அமைவு வழிகாட்டி.',
        'இவை தற்போது கட்டப்பட்டு வருகின்றன. ஒவ்வொன்றும் தயாரான உடன், இந்தத் திரையும் முழு கையேடும் உண்மையான வழிமுறைகளுடன் புதுப்பிக்கப்படும்.'
      ]
    }
  }
];

function helpDownloadLinks() {
  return `
    <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:14px">
      <a class="btn secondary" style="text-decoration:none" href="/docs/HANDBOOK_EN.md" target="_blank" rel="noopener">⬇ Full Handbook (English)</a>
      <a class="btn secondary" style="text-decoration:none" href="/docs/HANDBOOK_TA.md" target="_blank" rel="noopener">⬇ முழு கையேடு (தமிழ்)</a>
    </div>`;
}

function renderHelp() {
  const c = document.getElementById('pageContent');
  c.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div class="toggle-group" style="margin-bottom:0" role="group" aria-label="Help language">
        <button data-help-lang="en" class="${helpLang === 'en' ? 'active' : ''}">English</button>
        <button data-help-lang="ta" class="${helpLang === 'ta' ? 'active' : ''}">தமிழ்</button>
      </div>
    </div>
    ${HELP_SECTIONS.map((s) => {
      const t = s[helpLang] || s.en;
      return `
      <div class="card" style="margin-bottom:14px">
        <div class="section-title"><h3>${s.icon} ${escapeHtml(t.title)}</h3></div>
        ${t.body.map((p) => `<p class="sub" style="font-size:0.95rem;line-height:1.5">${escapeHtml(p)}</p>`).join('')}
      </div>`;
    }).join('')}
    ${helpDownloadLinks()}
  `;
  c.querySelectorAll('[data-help-lang]').forEach((b) => {
    b.onclick = () => {
      helpLang = b.dataset.helpLang;
      localStorage.setItem('pilk_help_lang', helpLang);
      renderHelp();
    };
  });
}
