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
    id: 'speed',
    icon: '⚡',
    en: {
      title: 'Selling faster (Sell screen)',
      body: [
        '⚡ Fast Intake — found an item one at a time from a WhatsApp supplier photo? Tap "Fast Intake" on Sell to log its real cost, selling price, and quantity right there — no trip to GRN needed. It writes a real stock record (same system the full GRN screen uses) and adds the item straight to the current cart.',
        '🔥 Frequently Sold — a row of one-tap tiles near the top of Sell, computed automatically from your last 60 days of real sales. Nothing to curate by hand.',
        'Cart quantity — tap the number on any cart line and type a quantity directly, instead of tapping + or − repeatedly.',
        'Keyboard shortcuts (desktop): Enter completes the sale once you\'re on the Sell screen and not typing in a field. Esc closes any open window/popup, or cancels an in-progress cart-quantity edit. "/" jumps straight to the customer search box.'
      ]
    },
    ta: {
      title: 'விரைவான விற்பனை (Sell திரை)',
      body: [
        '⚡ Fast Intake — WhatsApp வழங்குநர் குழுவிலிருந்து ஒரு பொருள் மட்டும் கிடைத்ததா? Sell திரையில் "Fast Intake"-ஐ தட்டி, உண்மையான cost, விற்பனை விலை, அளவு ஆகியவற்றை உடனே பதிவு செய்யலாம் — GRN திரைக்குச் செல்ல வேண்டாம். இது முழு GRN திரை பயன்படுத்தும் அதே பதிவு முறையில் சேமிக்கப்பட்டு, தற்போதைய கார்ட்டில் நேரடியாகச் சேர்க்கப்படும்.',
        '🔥 Frequently Sold — கடந்த 60 நாட்களின் உண்மையான விற்பனையிலிருந்து தானாகக் கணக்கிடப்பட்ட, ஒரே தட்டலில் சேர்க்கக்கூடிய பொருட்களின் வரிசை, Sell திரையின் மேலே.',
        'கார்ட் அளவு — + / − தட்டுவதற்குப் பதிலாக, கார்ட் வரிசையில் உள்ள எண்ணைத் தட்டி நேரடியாக அளவை தட்டச்சு செய்யலாம்.',
        'விசைப்பலகை குறுக்குவழிகள் (desktop): Sell திரையில், எதுவும் தட்டச்சு செய்யாத போது Enter — விற்பனையை முடிக்கும். Esc — திறந்திருக்கும் எந்த சாளரத்தையும் மூடும், அல்லது கார்ட் அளவு திருத்தத்தை ரத்து செய்யும். "/" — வாடிக்கையாளர் தேடலுக்கு நேரடியாகச் செல்லும்.'
      ]
    }
  },
  {
    id: 'coming',
    icon: '🚧',
    en: {
      title: 'Coming soon',
      body: [
        'Barcode scanning at checkout, splitting a sale between cash and card, an end-of-day till-reconciliation report, and remote login from outside the shop WiFi. This screen will be updated the moment each one works.',
        'Already done: the 15-question setup wizard (Settings → Run Setup Wizard), and the Sell screen now saves a sale even with no connection and syncs it automatically once you’re back online (not yet covering GRN or other screens).'
      ]
    },
    ta: {
      title: 'விரைவில் வரும்',
      body: [
        'பில்லிங்கில் Barcode ஸ்கேன், cash+card பிரித்துச் செலுத்துதல், நாள் முடிவு காசு சரிபார்ப்பு அறிக்கை, கடைக்கு வெளியே இருந்து லாகின். ஒவ்வொன்றும் தயாரான உடன் இந்தத் திரை புதுப்பிக்கப்படும்.',
        'ஏற்கனவே தயார்: 15-கேள்வி அமைவு வழிகாட்டி (Settings → Run Setup Wizard), மற்றும் Sell திரை இப்போது இணைப்பு இல்லாமலும் விற்பனையை பதிவு செய்து மீண்டும் இணைப்பு வந்தவுடன் தானாக sync செய்யும் (Sell திரைக்கு மட்டும், இன்னும் GRN-க்கு இல்லை).'
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
