// Real content. Hero cards = SITE.papers (7 picks). Full list = SITE.allPapers.
// Posters render in their own section after papers. Pdf paths are relative to
// the site root (served from "Personal Website/").
window.SITE = {
  name: "Ethan Farah",
  domain: "farah.fyi",
  tagline: "computational fluid dynamics in cardiovascular systems · machine learning systems · quantitative finance",
  about:
    "Stanford Biomechanical Engineering BS '26 + Computer Science MS coterm. I work on patient-specific cardiovascular CFD with the Marsden Lab, on RL/LLM systems research, and on quantitative finance — derivatives and reinforcement-learning trading.",
  email: "ethan@farah.fyi",
  github: "github.com/ethanfarah",
  linkedin: "linkedin.com/in/ethanfarah",
  cv: "pdfs/ethan-farah-cv.pdf",

  // ---- 7 hero cards (the floating papers over the artery animation) ----
  papers: [
    {
      title: "Patient-specific computational hemodynamic performance modeling of an off-the-shelf multi-branched thoracoabdominal endoprosthesis",
      venue: "Research · 2026",
      year: 2026,
      authors: "Ethan Farah, Alison Marsden, Jason T. Lee, Kenneth Tran",
      tags: ["CFD", "cardiovascular", "vascular surgery"],
      blurb:
        "A reduced-order CFD framework for patient-specific hemodynamic assessment of an off-the-shelf multi-branched thoracoabdominal endograft. Pilot study with the Marsden Lab and Stanford Vascular Surgery.",
      pdf: "pdfs/tambe-main.pdf",
      bibtex: null,
      code: null,
    },
    {
      title: "miRNA-based lung cancer classification with stratified validation and aptamer biochip design",
      venue: "BIOE 141B Capstone · 2026",
      year: 2026,
      authors: "Team Tidal — Spencer Cha, Vedant Chittake, Ethan Farah, Brian Lim, Vivian Tien",
      tags: ["ML", "biomedical", "capstone"],
      blurb:
        "miRNA expression-based lung cancer classification with stratified validation that controls for age confounding, paired with an aptamer biochip design. Year-long Bioengineering capstone.",
      pdf: "pdfs/bioe141b-mirna.pdf",
      bibtex: null,
      code: null,
    },
    {
      title: "Comparing RL Algorithms, Rewards, and Policy Architectures for Token-Level Prompt Compression",
      venue: "CS 234 · 2026",
      year: 2026,
      authors: "Ethan Farah, Ethan Harianto, Jessica Hu",
      tags: ["RL", "NLP", "LLM"],
      blurb:
        "Compares PPO, DPO, and GRPO on a token-level prompt-compression task; studies reward shaping for the compression-ratio vs. downstream-faithfulness trade-off.",
      pdf: "pdfs/cs234-prompt-compression.pdf",
      bibtex: null,
      code: null,
    },
    {
      title: "Hierarchical Reinforcement Learning for Cryptocurrency Trading via Adaptive Strategy Selection",
      venue: "CS 230 · 2026",
      year: 2026,
      authors: "Ethan Farah, Daniel (co-author)",
      tags: ["deep RL", "finance", "crypto"],
      blurb:
        "A hierarchical RL agent that selects between specialized sub-policies for SOL-PERP perpetual futures trading; outperforms flat policies on out-of-sample data.",
      pdf: "pdfs/cs230-solana-hrl.pdf",
      bibtex: null,
      code: null,
    },
    {
      title: "Gap-Aware Instance Optimality of the Secretary Problem under Smoothed Perturbation",
      venue: "CS 264 · 2026",
      year: 2026,
      authors: "Ethan Farah",
      tags: ["theory", "online algorithms"],
      blurb:
        "Establishes gap-aware instance-optimal regret bounds for the secretary problem under smoothed perturbation, beyond the classical worst-case 1/e barrier.",
      pdf: "pdfs/cs264-secretary.pdf",
      bibtex: null,
      code: null,
    },
    {
      title: "medAIval — ICD-10 medical coding with attention",
      venue: "CS 229 · 2025",
      year: 2025,
      authors: "Daniel Yang, Ethan Farah",
      tags: ["ML", "NLP", "medical"],
      blurb:
        "Attention-based ICD-10 medical-code prediction from clinical notes; analyzes attention patterns and characterizes class-imbalance failure modes across diagnosis chapters.",
      pdf: "pdfs/cs229-medaival.pdf",
      bibtex: null,
      code: null,
    },
    {
      title: "Enhanced Perfluorocarbon Delivery Systems for Emergency Medicine: Magnetic Clamshell + Deformable Mesh",
      venue: "ME 235 · 2025",
      year: 2025,
      authors: "Ethan Farah",
      tags: ["biomedical", "devices"],
      blurb:
        "Magnetic clamshell and deformable-mesh oxygen-carrier delivery systems for emergency medicine, integrating perfluorocarbon transport models.",
      pdf: "pdfs/me235-perfluorocarbon.pdf",
      bibtex: null,
      code: null,
    },
  ],

  // ---- Full papers list (everything, hero 7 + the rest) ----
  // The renderer uses this for the #papers grid; hero cards still use papers[].
  // Order: hero 7 first (so list[0..6] === papers), then additional below.
  allPapers: null, // populated below; kept here for shape clarity

  // ---- Posters section (#posters, after #papers) ----
  posters: [
    {
      title: "Patient-specific computational hemodynamic performance modeling of an off-the-shelf multi-branched thoracoabdominal endoprosthesis",
      venue: "Bio-X Symposium · Stanford Research Conference",
      year: 2026,
      authors: "Ethan Farah, Alison Marsden, Jason T. Lee, Kenneth Tran",
      tags: ["CFD", "cardiovascular", "poster"],
      blurb:
        "Poster version of the patient-specific TAMBE hemodynamic assessment framework, presented across multiple Stanford research venues.",
      pdf: "pdfs/tambe-poster.pdf",
      bibtex: null,
      code: null,
    },
    {
      title: "Comparing RL Algorithms, Rewards, and Policy Architectures for Token-Level Prompt Compression",
      venue: "CS 234 · 2026",
      year: 2026,
      authors: "Ethan Farah, Ethan Harianto, Jessica Hu",
      tags: ["RL", "NLP", "poster"],
      blurb:
        "Poster summarizing PPO/DPO/GRPO comparisons for token-level prompt compression, with reward-design ablations.",
      pdf: "pdfs/cs234-poster.pdf",
      bibtex: null,
      code: null,
    },
    {
      title: "Hierarchical Reinforcement Learning for Cryptocurrency Trading",
      venue: "CS 230 · 2026",
      year: 2026,
      authors: "Ethan Farah, Daniel (co-author)",
      tags: ["deep RL", "finance", "poster"],
      blurb:
        "Poster summarizing the hierarchical-RL Solana perpetual-futures trading agent.",
      pdf: "pdfs/cs230-solana-poster.pdf",
      bibtex: null,
      code: null,
    },
    {
      title: "medAIval — ICD-10 medical coding with attention",
      venue: "CS 229 · 2025",
      year: 2025,
      authors: "Daniel Yang, Ethan Farah",
      tags: ["ML", "NLP", "poster"],
      blurb:
        "Poster version of the attention-based ICD-10 medical-coding system.",
      pdf: "pdfs/cs229-medaival-poster.pdf",
      bibtex: null,
      code: null,
    },
    {
      title: "Live Non-Isolated Sign Language Recognition",
      venue: "Vision/ML · 2025",
      year: 2025,
      authors: "Daniel Yang, Ethan Farah",
      tags: ["computer vision", "ViViT", "poster"],
      blurb:
        "Live, continuous American Sign Language recognition using a video-transformer (ViViT) architecture, evaluated on a non-isolated benchmark.",
      pdf: "pdfs/sign-language-poster.pdf",
      bibtex: null,
      code: null,
    },
    {
      title: "DumBow the flying elephant",
      venue: "ME 80 · 2025",
      year: 2025,
      authors: "Ethan Farah, Jonathan Siskind",
      tags: ["mechanical", "design", "poster"],
      blurb:
        "Companion poster to the ME 80 bow analysis paper — design + physical-build of an archery test rig.",
      pdf: "pdfs/me80-dumbow-poster.pdf",
      bibtex: null,
      code: null,
    },
  ],

  // ---- Projects section ----
  // GitHub URLs to be filled in once Ethan provides them.
  projects: [
    {
      title: "Veridian",
      blurb:
        "AI-powered handwritten math mistake analysis with Socratic chat tutoring. Production deployment for K-12 classrooms.",
      code: null,
    },
    {
      title: "Prompt Compression",
      blurb:
        "Token-level RL prompt compression — reward design and policy architectures for compressing LLM context.",
      code: null,
    },
    {
      title: "SkillFlow",
      blurb:
        "Composable skill chaining for Claude Code agents with clean I/O contracts.",
      code: null,
    },
  ],
};

// Build allPapers = hero 7 + the rest. Put placeholder/sign-language at the end.
window.SITE.allPapers = [
  ...window.SITE.papers,
  {
    title: "TAMBE — characteristic peak-pressure model (supplementary)",
    venue: "Research · 2026",
    year: 2026,
    authors: "Ethan Farah, Alison Marsden, Jason T. Lee, Kenneth Tran",
    tags: ["CFD", "model", "supplementary"],
    blurb:
      "Closed-form characteristic peak-pressure model for branched-graft hemodynamics, calibrated against the patient cohort.",
    pdf: "pdfs/tambe-peak-model.pdf",
    bibtex: null,
    code: null,
  },
  {
    title: "Perfluorocarbon-Based Biomimetic Oxygen Carriers for Sickle Cell Disease",
    venue: "ME 283 · 2025",
    year: 2025,
    authors: "Ethan Farah",
    tags: ["biomedical", "devices"],
    blurb:
      "Perfluorocarbon-based biomimetic oxygen carriers for sickle cell disease, building on the magnetic clamshell + deformable mesh delivery framework.",
    pdf: "pdfs/me283-perfluorocarbon.pdf",
    bibtex: null,
    code: null,
  },
  {
    title: "Grug (30000 BCE) finally know why long bow gooder than thick bow",
    venue: "ME 80 · 2025",
    year: 2025,
    authors: "Ethan Farah, Jonathan Siskind",
    tags: ["mechanical", "sensitivity analysis"],
    blurb:
      "Free-body and sensitivity analysis of bow length vs. limb thickness on draw-force-displacement, with physical validation.",
    pdf: "pdfs/me80-bow.pdf",
    bibtex: null,
    code: null,
  },
  {
    title: "Leveraging Q-Learning for Uncertainty within Medical Diagnosis",
    venue: "CS 238 · 2025",
    year: 2025,
    authors: "David Maemoto, Ethan Farah",
    tags: ["RL", "medical", "uncertainty"],
    blurb:
      "Q-learning under uncertainty for sequential medical-diagnosis decisions.",
    pdf: "pdfs/cs238-medical-q.pdf",
    bibtex: null,
    code: null,
  },
  {
    title: "Fundamental Concepts of Analysis",
    venue: "Math 171 · 2024",
    year: 2024,
    authors: "Ethan Farah",
    tags: ["mathematics", "analysis"],
    blurb:
      "Final paper synthesizing fundamental concepts from a rigorous real-analysis course.",
    pdf: "pdfs/math171-analysis.pdf",
    bibtex: null,
    code: null,
  },
  {
    title: "Live Non-isolated Sign Language Recognition Using Transformers",
    venue: "CVPR-format · 2025",
    year: 2025,
    authors: "Daniel Yang, Ethan Farah",
    tags: ["computer vision", "transformers", "ViViT"],
    blurb:
      "Live, continuous American Sign Language recognition using a video-transformer (ViViT) architecture, evaluated on a non-isolated benchmark.",
    pdf: "pdfs/sign-language-paper.pdf",
    bibtex: null,
    code: null,
  },
];
