/* ============================================================
   SMC Academy — curated Smart Money Concepts video library data
   All video IDs verified live via YouTube oEmbed (2026-09-07).
   ============================================================ */

window.SMC_DATA = (function () {
  "use strict";

  // Category keys used to group the library + modules
  var CATEGORIES = [
    { key: "full",      label: "Full Courses",                blurb: "Complete beginner → pro SMC & ICT curricula." },
    { key: "structure", label: "Market Structure",            blurb: "BOS, CHoCH & MSS — learning to read who controls price." },
    { key: "liquidity", label: "Liquidity & Sweeps",          blurb: "Buy/sell-side liquidity, stop hunts and manipulation." },
    { key: "ob-fvg",    label: "Order Blocks & FVGs",         blurb: "The institutional zones smart money leaves behind." },
    { key: "pd-ote",    label: "Premium, Discount & OTE",     blurb: "Enter only where price offers value." },
    { key: "sessions",  label: "Killzones & Entry Models",    blurb: "Power of 3, Silver Bullet and session timing." },
    { key: "advanced",  label: "Advanced & Models",           blurb: "2025 models, market-maker logic and reference deep dives." }
  ];

  var VIDEOS = [
    /* ---------- FULL COURSES ---------- */
    {
      id: "zrkfntcsorg",
      title: "The ULTIMATE Smart Money Concepts Guide (Full SMC Course)",
      channel: "Lewis Kelly",
      cat: "full",
      level: "Beginner",
      lang: "English",
      desc: "A structured, end-to-end walkthrough of the SMC framework — market structure, liquidity, order blocks and fair value gaps — from zero to a complete trading model.",
      tags: ["full course", "market structure", "liquidity", "order block", "fvg"]
    },
    {
      id: "aPz_9jdNWPc",
      title: "Smart Money Concepts SMC | ICT Trading Full Course | Liquidity, CHOCH, BOS & Market Timing",
      channel: "Accounting Guy",
      cat: "full",
      level: "Beginner",
      lang: "English",
      desc: "A condensed ICT/SMC curriculum covering liquidity, CHOCH, BOS and market timing — everything you need to build an institutional way of thinking.",
      tags: ["ict", "full course", "liquidity", "choch", "bos", "market timing"]
    },
    {
      id: "enwGyswTzUE",
      title: 'The Ultimate "Smart Money Course" Ever | Liquidity – Imbalances – Manipulation | SMC | ICT',
      channel: "Fortune Talks",
      cat: "full",
      level: "Intermediate",
      lang: "English",
      desc: "One big course that ties together liquidity, imbalances and manipulation — the complete SMC/ICT toolbox with live chart examples.",
      tags: ["full course", "liquidity", "imbalance", "manipulation", "ict"]
    },
    {
      id: "6u7kpCEVROc",
      title: "Top 4 ICT/SMC Strategies to Make Money in 2024 (Full Course)",
      channel: "Mulham Trading",
      cat: "full",
      level: "Intermediate",
      lang: "English",
      desc: "Four concrete, repeatable ICT/SMC strategies explained as a free full course — turn the concepts into an actual daily playbook.",
      tags: ["full course", "strategy", "ict", "playbook"]
    },
    {
      id: "Muk5exjw0HY",
      title: "Smart Money Concepts for Beginners (Full LuxAlgo Course)",
      channel: "Michael Whitman",
      cat: "full",
      level: "Beginner",
      lang: "English",
      desc: "Learn SMC hands-on with the LuxAlgo Smart Money Concepts suite on TradingView — BOS, CHoCH, order blocks and FVGs mapped automatically.",
      tags: ["tradingview", "luxalgo", "indicator", "beginner"]
    },
    {
      id: "6GNfCpyPawo",
      title: "Smart Money Concept Full Course For FREE! | SMC Trading Strategy",
      channel: "Neeraj Joshi",
      cat: "full",
      level: "Beginner",
      lang: "Hindi",
      desc: "A complete free SMC strategy course in Hindi — market structure, liquidity and order blocks explained step by step.",
      tags: ["full course", "hindi", "beginner"]
    },

    /* ---------- MARKET STRUCTURE ---------- */
    {
      id: "UXW1o6Gdq6I",
      title: "Market Structure – BoS & CHoCH/MSS – Smart Money/ICT Concepts Course (Episode #1)",
      channel: "The 10% Enterprise",
      cat: "structure",
      level: "Beginner",
      lang: "English",
      desc: "Episode one of the Smart Money/ICT concepts course — a deep dive into Breaks of Structure (BoS) and Change of Character / Market Structure Shift.",
      tags: ["bos", "choch", "mss", "market structure"]
    },
    {
      id: "cBYy74S8A3k",
      title: "Market Structure | ICT Smart Money Concept | BOS, CHOCH, MSS | Crypto Trading",
      channel: "Muhammad Bilal",
      cat: "structure",
      level: "Beginner",
      lang: "English",
      desc: "Learn to label BOS, CHOCH and MSS cleanly on any timeframe, with crypto chart examples — the first skill every SMC trader needs.",
      tags: ["bos", "choch", "mss", "crypto", "market structure"]
    },

    /* ---------- LIQUIDITY ---------- */
    {
      id: "GkNhn-k05MY",
      title: "I Learned How Smart Money Triggers Stop Hunts — The Exit Liquidity Traps",
      channel: "The Secret Mindset",
      cat: "liquidity",
      level: "Intermediate",
      lang: "English",
      desc: "Why your stops keep getting hunted. Learn how exit-liquidity traps work, how trapped traders fuel the move — and how to stand on the right side.",
      tags: ["stop hunt", "liquidity", "exit liquidity", "traps"]
    },
    {
      id: "RjR2kTErlq4",
      title: "Smart Money Concepts: How I Combine Liquidity Sweeps, FVGs & Order Blocks (Full Strategy)",
      channel: "Smart Risk",
      cat: "liquidity",
      level: "Intermediate",
      lang: "English",
      desc: "An A+ SMC setup broken down: liquidity sweep, then fair value gap + order block retest — a complete high-conviction entry model.",
      tags: ["liquidity sweep", "fvg", "order block", "a+ setup", "strategy"]
    },

    /* ---------- ORDER BLOCKS & FVGs ---------- */
    {
      id: "hVX3OdkOhB4",
      title: "Order Blocks vs. Fair Value Gaps: The Ultimate Guide to Smarter Entries!",
      channel: "Smart Risk",
      cat: "ob-fvg",
      level: "Intermediate",
      lang: "English",
      desc: "Rules for identifying valid, high-probability order blocks versus fair value gaps — and when each one gives you the better entry.",
      tags: ["order block", "fvg", "entries", "confluence"]
    },
    {
      id: "QrYW_qzWmrg",
      title: "ICT Smart Money Concepts Explained: Liquidity, FVG & Order Blocks",
      channel: "Com Lucro Trader",
      cat: "ob-fvg",
      level: "Beginner",
      lang: "English",
      desc: "Master liquidity, fair value gaps and order blocks — the three pillars that separate random trading from structured execution.",
      tags: ["liquidity", "fvg", "order block", "beginner"]
    },
    {
      id: "DOJRiwm5B-o",
      title: "Fair Value Gap, Order Block & Liquidity Sweep Trading Strategy (Hindi)",
      channel: "SMC Hindi Academy",
      cat: "ob-fvg",
      level: "Intermediate",
      lang: "Hindi",
      desc: "Combine fair value gap, order block and liquidity sweep into one SMC trading strategy — explained in Hindi with examples.",
      tags: ["fvg", "order block", "liquidity sweep", "hindi"]
    },

    /* ---------- PREMIUM / DISCOUNT / OTE ---------- */
    {
      id: "7emw-Ok9gho",
      title: "OTE Is The Most Precise Entry In Smart Money Trading",
      channel: "Trader Mayne",
      cat: "pd-ote",
      level: "Intermediate",
      lang: "English",
      desc: "Episode 9 of the Trader Mayne Full Bootcamp — the ICT Optimal Trade Entry and why it produces the most precise entries in smart money trading.",
      tags: ["ote", "fibonacci", "entries", "bootcamp"]
    },
    {
      id: "Dx3Wq1GYYOE",
      title: "Optimal Trade Entry (OTE) Explained | ICT Smart Money Concepts",
      channel: "Wisdom Archives",
      cat: "pd-ote",
      level: "Intermediate",
      lang: "English",
      desc: "How to refine entries with Optimal Trade Entry — the 62–79% retracement zone, premium/discount logic, and its place in the ICT workflow.",
      tags: ["ote", "fibonacci", "premium discount", "entries"]
    },

    /* ---------- KILLZONES & ENTRY MODELS ---------- */
    {
      id: "qM5liah_6QI",
      title: "ICT Killzone Trading Strategy (Step-by-Step Guide for Beginners)",
      channel: "Smart Risk",
      cat: "sessions",
      level: "Beginner",
      lang: "English",
      desc: "When do institutions actually trade? A step-by-step beginner guide to the London and New York killzones and how to time entries around them.",
      tags: ["killzone", "sessions", "london", "new york", "timing"]
    },
    {
      id: "t0a2AkZC9tk",
      title: "ICT Silver Bullet Strategy Explained | Price Action Scalping Setup",
      channel: "Adib Noorani",
      cat: "sessions",
      level: "Intermediate",
      lang: "English",
      desc: "The ICT Silver Bullet scalping setup — a no-indicator strategy built on liquidity, the fair value gap and the 10–11am New York window.",
      tags: ["silver bullet", "scalping", "fvg", "liquidity"]
    },
    {
      id: "_EQFJ_TLV58",
      title: "Simple ICT Silver Bullet Strategy | 70% Win Rate",
      channel: "JadeCap",
      cat: "sessions",
      level: "Intermediate",
      lang: "English",
      desc: "A simple, rules-based Silver Bullet implementation — entry, stop and target logic spelled out so you can backtest and execute it consistently.",
      tags: ["silver bullet", "scalping", "backtest"]
    },
    {
      id: "B5I-2TuMMcI",
      title: "Accumulation → Manipulation → Distribution: Full Breakdown",
      channel: "Crypto4light Trading",
      cat: "sessions",
      level: "Beginner",
      lang: "English",
      desc: "The Power of 3 strategy — how accumulation, manipulation and distribution repeat on every timeframe and market, and how to trade the cycle.",
      tags: ["power of 3", "amd", "accumulation", "manipulation", "distribution"]
    },
    {
      id: "9LvhsU5YIBA",
      title: "Every Market Move Follows This Pattern (ICT Power Of 3)",
      channel: "Trader Mayne",
      cat: "sessions",
      level: "Intermediate",
      lang: "English",
      desc: "Episode 10 of the Trader Mayne Full Bootcamp — how every market move follows the Power of 3 pattern, including the Judas swing.",
      tags: ["power of 3", "judas swing", "bootcamp"]
    },

    /* ---------- ADVANCED & MODELS ---------- */
    {
      id: "BME_zGhJQGU",
      title: "ICT's 2025 Model EXPLAINED: The Next Evolution in Smart Money Trading!",
      channel: "Andrew Capital",
      cat: "advanced",
      level: "Advanced",
      lang: "English",
      desc: "A breakdown of ICT's 2025 model — key principles, new insights and how to apply it to daily setups on ES/MNQ, forex and crypto.",
      tags: ["ict 2025", "market maker model", "advanced", "nq", "es"]
    },
    {
      id: "nocba4qX1dQ",
      title: "Best Smart Money Concept SMC Trading Strategy Book (Full PDF Course ICT)",
      channel: "VasilyTrader",
      cat: "advanced",
      level: "Advanced",
      lang: "English",
      desc: "A page-by-page walkthrough of a written SMC strategy course — liquidity zones, order blocks, imbalance, inducement and the full methodology.",
      tags: ["book", "reference", "pdf course", "inducement"]
    }
  ];

  // Suggested first watch — feeds the "Start here" inline player
  var WATCHLIST = [
    { id: "zrkfntcsorg", why: "The full framework in one sitting — start with the complete guide." },
    { id: "UXW1o6Gdq6I", why: "Learn to read BOS & CHoCH before adding anything else." },
    { id: "hVX3OdkOhB4", why: "The two zones you will mark on every single chart." },
    { id: "GkNhn-k05MY", why: "Understand why price hunts stops — the heart of SMC." },
    { id: "qM5liah_6QI", why: "Know the exact hours institutions are active." }
  ];

  // Learning-path modules (each maps to a library category)
  var MODULES = [
    { n: 1, cat: "structure", title: "Understand market structure", text: "BOS, CHoCH & MSS — learn to see who is in control of price before you do anything else." },
    { n: 2, cat: "liquidity",  title: "Think in liquidity",          text: "Buy-side & sell-side liquidity, stop hunts and why price is engineered toward obvious levels." },
    { n: 3, cat: "ob-fvg",     title: "Mark institutional zones",    text: "Spot the order blocks and fair value gaps smart money leaves behind after every impulse." },
    { n: 4, cat: "pd-ote",     title: "Enter in premium & discount", text: "Only buy value and sell premium — refine entries with the Optimal Trade Entry zone." },
    { n: 5, cat: "sessions",   title: "Time your executions",        text: "Killzones, the Power of 3 cycle and the Silver Bullet — be in the market in the right hour." },
    { n: 6, cat: "full",       title: "Build your SMC strategy",     text: "Full-length courses that connect every concept into one repeatable institutional plan." }
  ];

  // The 5-step strategy playbook
  var PLAYBOOK = [
    { step: "01", title: "Set your bias", text: "Swing timeframe first. Mark the most recent CHoCH / BOS on Daily and H4 — that decides whether you hunt longs or shorts." },
    { step: "02", title: "Stack the PD arrays", text: "Flag the nearest untested order block or fair value gap in line with bias, then drop to the 15m to refine it into an entry zone." },
    { step: "03", title: "Map liquidity", text: "Draw equal highs & lows, session extremes and old swing points. Buy-side liquidity sits above them, sell-side below." },
    { step: "04", title: "Wait for the sweep + MSS", text: "Never chase the break. Let price grab liquidity, then wait for displacement and a structure shift back in your direction." },
    { step: "05", title: "Manage like an institution", text: "Risk max 1% per trade. Stop beyond the sweep wick, target the opposing liquidity pool, and trail behind fresh order blocks." }
  ];

  // Glossary — plain-language SMC terms
  var TERMS = [
    { term: "Market structure", def: "The sequence of swing highs and lows (HH, HL, LH, LL) that tells you who is in control — buyers or sellers." },
    { term: "BOS — Break of Structure", def: "Price breaks a previous high/low in the direction of the current trend, confirming continuation." },
    { term: "CHoCH / MSS", def: "Change of Character / Market Structure Shift — price breaks against the trend, the first sign a reversal may be starting." },
    { term: "Order Block (OB)", def: "The last opposing candle before a strong institutional impulse; a zone where big orders were likely placed." },
    { term: "Fair Value Gap (FVG)", def: "A three-candle imbalance where price moved too fast to fill every level — price tends to return ('fill') before continuing." },
    { term: "Liquidity", def: "Resting orders and stop losses clustered above highs (buy-side, BSL) and below lows (sell-side, SSL). Smart money moves price toward it." },
    { term: "Liquidity sweep / stop hunt", def: "A quick spike through an obvious level that triggers stops, then reverses — institutions fill at that liquidity." },
    { term: "Premium & Discount", def: "The upper (expensive) and lower (cheap) halves of a dealing range. Smart money buys discount and sells premium." },
    { term: "OTE", def: "Optimal Trade Entry — the 62–79% Fibonacci retracement zone where high-probability reactions often occur." },
    { term: "Power of 3 (AMD)", def: "Accumulation → Manipulation → Distribution: the expansion, retracement and expansion cycle behind most moves." },
    { term: "Killzone", def: "The London and New York session windows (plus Asian range) when institutional volume and the biggest moves occur." },
    { term: "Silver Bullet", def: "An ICT scalping model traded inside the 10–11am New York killzone using liquidity sweeps and a fair value gap entry." }
  ];

  return {
    CATEGORIES: CATEGORIES,
    VIDEOS: VIDEOS,
    WATCHLIST: WATCHLIST,
    MODULES: MODULES,
    PLAYBOOK: PLAYBOOK,
    TERMS: TERMS
  };
})();
