# AI-writing patterns

Lookup table. Process, genre, and the fact rule live in [SKILL.md](../SKILL.md). Vocabulary lists live in [word-tiers.md](word-tiers.md).

**Cluster rule.** Isolated tells are not evidence. Rewrite (or report, in review mode) when several coincide, or when a high-confidence wrapper appears (chatbot leftover, knowledge-cutoff disclaimer, emoji-header list). A single em dash, a single `however`, or curly quotes from Word/macOS are not findings. Zero findings is a valid outcome.

**After-examples never add facts.** Every name, number, date, quote, and citation in an After already appears in the Before. Imitate that.

**Source caveat.** Wikipedia's list is a *descriptive* field guide for encyclopedia prose, not a style guide for blogs or engineering docs. Some signs do not apply off-wiki.

## What not to flag

- Perfect grammar, consistent style, or complex formatting
- Formal or academic vocabulary that is not on the tier lists
- Mixed casual/formal register
- Dry prose with no listed tells
- Letter-style greeting or sign-off
- One short emphatic sentence
- "Honestly" or "look" mid-sentence (the tell is the standalone theatrical opener)
- Unsourced claims (most of the web is unsourced)
- Quoted material, titles, proper names, or phrases being discussed rather than used
- An em dash or curly quotes alone
- Shop words in engineering register (`optimize`, `roadmap`, `framework`)

## Preserve these (do not sand them off)

- Specific, hard-to-fabricate detail that is already in the source
- Mixed feelings and unresolved tension
- First-person the author already used
- Genuine asides, parentheticals, or self-corrections
- Uneven sentence length that is already there
- Dated, era-bound references already in the source

---

## Content (1–6)

### 1. Undue emphasis on significance, legacy, and broader trends

**Words to watch:** stands/serves as, is a testament/reminder, a vital/significant/crucial/pivotal/key role/moment, underscores/highlights its importance/significance, reflects broader, symbolizing its ongoing/enduring/lasting, contributing to the, setting the stage for, marking/shaping the, represents/marks a shift, key turning point, evolving landscape, focal point, indelible mark, deeply rooted

**Problem:** LLM writing puffs up importance by claiming arbitrary details represent or contribute to a broader topic.

**Before:**
> The Statistical Institute of Catalonia was officially established in 1989, marking a pivotal moment in the evolution of regional statistics in Spain. This initiative was part of a broader movement across Spain to decentralize administrative functions and enhance regional governance.

**After:**
> The Statistical Institute of Catalonia was established in 1989, part of a wider decentralization of administrative functions in Spain.

### 2. Undue emphasis on notability and media coverage

**Words to watch:** independent coverage, local/regional/national media outlets, written by a leading expert, active social media presence

**Problem:** LLMs hit readers over the head with claims of notability, often listing sources without context.

**Before:**
> Her views have been cited in The New York Times, BBC, Financial Times, and The Hindu. She maintains an active social media presence with over 500,000 followers.

**After:**
> Her views have been cited in The New York Times and the BBC. She has over 500,000 social-media followers.

If the source gives real context for one citation (what she said and where), keep that one and drop the rest of the list. Do not invent the context.

### 3. Superficial analyses with -ing endings

**Words to watch:** highlighting/underscoring/emphasizing..., ensuring..., reflecting/symbolizing..., contributing to..., cultivating/fostering..., encompassing..., showcasing...

**Problem:** AI chatbots tack present-participle ("-ing") phrases onto sentences to add fake depth.

**Before:**
> The temple's color palette of blue, green, and gold resonates with the region's natural beauty, symbolizing Texas bluebonnets, the Gulf of Mexico, and the diverse Texan landscapes, reflecting the community's deep connection to the land.

**After:**
> The temple is painted blue, green, and gold, colors meant to evoke Texas bluebonnets and the Gulf of Mexico.

### 4. Promotional and advertisement-like language

**Words to watch:** boasts a, nestled, in the heart of, natural beauty, breathtaking, must-visit, stunning, renowned, commitment to. Shared adjectives (`vibrant`, `rich`, `groundbreaking`) live in [word-tiers.md](word-tiers.md).

**Problem:** LLMs slip into travel-brochure or press-release tone.

**Before:**
> Nestled within the breathtaking region of Gonder in Ethiopia, Alamata Raya Kobo stands as a vibrant town with a rich cultural heritage and stunning natural beauty.

**After:**
> Alamata Raya Kobo is a town in the Gonder region of Ethiopia.

### 5. Vague attributions and weasel words

**Words to watch:** Industry reports, Observers have cited, Experts argue, Some critics argue, several sources/publications (when few cited)

**Problem:** Opinions get attributed to vague authorities with no named source.

**Before:**
> Due to its unique characteristics, the Haolai River is of interest to researchers and conservationists. Experts believe it plays a crucial role in the regional ecosystem.

**After:**
> Researchers and conservationists study the Haolai River for its unusual characteristics.

If a real source exists in the input, name it. Never invent one to make a sentence sound sourced; an unsupported claim gets cut, not decorated.

### 6. Formulaic "challenges and future prospects" sections

**Words to watch:** Despite its... faces several challenges..., Despite these challenges, Challenges and Legacy, Future Outlook

**Problem:** Many LLM articles include a canned Challenges section that says nothing specific.

**Before:**
> Despite its industrial prosperity, Korattur faces challenges typical of urban areas, including traffic congestion and water scarcity. Despite these challenges, with its strategic location and ongoing initiatives, Korattur continues to thrive as an integral part of Chennai's growth.

**After:**
> Korattur has traffic congestion and water shortages.

---

## Language and grammar (7–13)

### 7. Overused AI vocabulary

Word lists: [word-tiers.md](word-tiers.md). The tell is **co-occurrence**, not a single ordinary word.

**Before:**
> Additionally, a distinctive feature of Somali cuisine is the incorporation of camel meat. An enduring testament to Italian colonial influence is the widespread adoption of pasta in the local culinary landscape, showcasing how these dishes have integrated into the traditional diet.

**After:**
> Somali cuisine also includes camel meat. Pasta, introduced during Italian colonization, remains common.

### 8. Avoidance of "is"/"are" (copula avoidance)

**Words to watch:** serves as/stands as/marks/represents [a], boasts/features/offers [a]

**Problem:** LLMs substitute elaborate constructions for simple copulas.

**Before:**
> Gallery 825 serves as LAAA's exhibition space for contemporary art. The gallery features four separate spaces and boasts over 3,000 square feet.

**After:**
> Gallery 825 is LAAA's exhibition space for contemporary art. The gallery has four rooms totaling 3,000 square feet.

### 9. Negative parallelisms and tailing negations

**Problem:** "Not only...but..." and "It's not just about..., it's..." are overused. So are clipped tailing-negation fragments ("no guessing") tacked onto a sentence instead of written as a clause.

**Before:**
> It's not just about the beat riding under the vocals; it's part of the aggression and atmosphere. It's not merely a song, it's a statement.

**After:**
> The heavy beat adds to the aggressive tone.

**Before (tailing negation):**
> The options come from the selected item, no guessing.

**After:**
> The options come from the selected item without forcing the user to guess.

### 10. Rule of three overuse

**Problem:** LLMs force ideas into groups of three to appear comprehensive.

**Before:**
> The event features keynote sessions, panel discussions, and networking opportunities. Attendees can expect innovation, inspiration, and industry insights.

**After:**
> The event includes talks and panels. There's also time for informal networking between sessions.

### 11. Elegant variation (synonym cycling)

**Problem:** Repetition penalties cause excessive synonym substitution.

**Before:**
> The protagonist faces many challenges. The main character must overcome obstacles. The central figure eventually triumphs. The hero returns home.

**After:**
> The protagonist faces many challenges but eventually triumphs and returns home.

### 12. False ranges

**Problem:** "from X to Y" where X and Y are not on a meaningful scale.

**Before:**
> Our journey through the universe has taken us from the singularity of the Big Bang to the grand cosmic web, from the birth and death of stars to the enigmatic dance of dark matter.

**After:**
> It covers the Big Bang, the birth and death of stars, and dark matter.

### 13. Passive voice and subjectless fragments

**Problem:** The actor is hidden, or the subject is dropped ("No configuration file needed"). Rewrite when active voice makes the sentence clearer. Distinct from pattern 31 (staccato drama).

**Before:**
> No configuration file needed. The results are preserved automatically.

**After:**
> You do not need a configuration file. The system preserves the results automatically.

---

## Style (14–19)

### 14. Em dash overuse

**Problem:** Stacked em dashes (—), spaced em dashes (` — `), and double hyphens (` -- `) used as punchy sales rhythm. An isolated em dash is not a tell (see What not to flag). A writing sample that uses them outranks this rule; match the sample's frequency.

**Before:**
> The term is primarily promoted by Dutch institutions—not by the people themselves. You don't say "Netherlands, Europe" as an address—yet this mislabeling continues—even in official documents.

**After:**
> The term is primarily promoted by Dutch institutions, not by the people themselves. You don't say "Netherlands, Europe" as an address, yet this mislabeling continues in official documents.

Replace stacked dashes with a period, comma, colon, or parentheses.

### 15. Overuse of boldface

**Problem:** Phrases get bolded mechanically.

**Before:**
> It blends **OKRs (Objectives and Key Results)**, **KPIs (Key Performance Indicators)**, and visual strategy tools such as the **Business Model Canvas (BMC)** and **Balanced Scorecard (BSC)**.

**After:**
> It blends OKRs, KPIs, and visual strategy tools like the Business Model Canvas and Balanced Scorecard.

### 16. Inline-header vertical lists

**Problem:** List items start with bolded headers followed by colons.

**Before:**
> - **User Experience:** The user experience has been significantly improved with a new interface.
> - **Performance:** Performance has been enhanced through optimized algorithms.
> - **Security:** Security has been strengthened with end-to-end encryption.

**After:**
> The update improves the interface, speeds up load times through optimized algorithms, and adds end-to-end encryption.

### 17. Title case in headings

**Problem:** Every main word in a heading is capitalized.

**Before:**
> ## Strategic Negotiations And Global Partnerships

**After:**
> ## Strategic negotiations and global partnerships

### 18. Emojis

**Problem:** Headings or bullets get decorative emoji.

**Before:**
> 🚀 **Launch Phase:** The product launches in Q3
> 💡 **Key Insight:** Users prefer simplicity
> ✅ **Next Steps:** Schedule follow-up meeting

**After:**
> The product launches in Q3. Users prefer simplicity. Next step: schedule a follow-up meeting.

### 19. Curly quotation marks

**Problem:** Curly quotes (“...”) instead of straight quotes ("..."). Only a tell when stacked with other patterns; Word and macOS auto-curl.

**Before:**
> He said “the project is on track” but others disagreed.

**After:**
> He said "the project is on track" but others disagreed.

---

## Communication (20–22)

### 20. Collaborative communication artifacts

**Words to watch:** I hope this helps, Of course!, Certainly!, You're absolutely right!, Would you like..., Want me to...?, let me know, here is a...

**Problem:** Chatbot correspondence gets pasted as content.

**Before:**
> Here is an overview of the French Revolution. It began in 1789 amid a financial crisis and food shortages. I hope this helps! Let me know if you'd like me to expand on any section.

**After:**
> The French Revolution began in 1789 amid a financial crisis and food shortages.

### 21. Knowledge-cutoff disclaimers and speculative gap-filling

**Words to watch:** as of [date], Up to my last training update, While specific details are limited/scarce..., based on available information, not publicly available, maintains a low profile, keeps personal details private, prefers to stay out of the spotlight, likely [grew up/studied/began], it is believed that

**Problem:** Two related tells. (a) A disclaimer about incomplete information is left in the text. (b) When a source is missing, the model writes a paragraph *about* not finding one, then invents plausible filler. Say what isn't known, or cut the sentence. Do not dress a guess up as fact.

**Before (cutoff disclaimer):**
> While specific details about the company's founding are not extensively documented in readily available sources, it appears to have been established sometime in the 1990s.

**After:**
> The company's founding date is not documented in the available sources.

**Before (speculative gap-fill):**
> Information about her early life is not publicly available, suggesting she maintains a low profile and keeps personal details private. She likely grew up in a middle-class household, which shaped her later interest in education reform.

**After:**
> Her early life is not documented in the available sources.

### 22. Sycophantic/servile tone

**Problem:** Overly positive, people-pleasing language.

**Before:**
> Great question! You're absolutely right that this is a complex topic. That's an excellent point about the economic factors.

**After:**
> The economic factors you mentioned are relevant here.

---

## Filler and hedging (23–29)

### 23. Filler phrases

**Before → After:**
- "In order to achieve this goal" → "To achieve this"
- "Due to the fact that it was raining" → "Because it was raining"
- "At this point in time" → "Now"
- "In the event that you need help" → "If you need help"
- "The system has the ability to process" → "The system can process"
- "It is important to note that the data shows" → "The data shows"

### 24. Excessive hedging

**Problem:** Over-qualifying statements.

**Before:**
> It could potentially possibly be argued that the policy might have some effect on outcomes.

**After:**
> The policy may affect outcomes.

### 25. Generic positive conclusions

**Problem:** Vague upbeat endings.

**Before:**
> The future looks bright for the company. Exciting times lie ahead as they continue their journey toward excellence. This represents a major step in the right direction.

**After:**
> (Cut the paragraph. End on the last concrete fact already in the source. If the source states real plans, use those.)

### 26. Hyphenated compounds

**Words to watch:** third-party, cross-functional, client-facing, data-driven, decision-making, well-known, high-quality, real-time, long-term, end-to-end

**Problem:** AI hyphenates these uniformly, including in predicate position (`the report is high-quality`). Keep the hyphen when the compound comes **before** the noun (`a high-quality report`). Drop it when the compound **follows** the noun (`the report is high quality`). Do not strip attributive hyphens; that is incorrect English, not more human.

**Before:**
> The cross-functional team delivered a high-quality, data-driven report. The team is cross-functional, the report is high-quality, and the methodology is data-driven.

**After:**
> The cross-functional team delivered a high-quality, data-driven report. The team is cross functional, the report is high quality, and the methodology is data driven.

### 27. Persuasive authority tropes

**Phrases to watch:** The real question is, at its core, in reality, what really matters, fundamentally, the deeper issue, the heart of the matter

**Problem:** Ceremony that pretends to cut through noise, then restates an ordinary point.

**Before:**
> The real question is whether teams can adapt. At its core, what really matters is organizational readiness.

**After:**
> The question is whether teams can adapt. That depends on organizational readiness.

### 28. Signposting and announcements

**Phrases to watch:** Let's dive in, let's explore, let's break this down, here's what you need to know, now let's look at, without further ado, In this section we'll..., ...as we've seen

**Problem:** The prose announces what it is about to do instead of doing it.

**Before:**
> Let's dive into how caching works in Next.js. Here's what you need to know. Next.js caches data at request memoization, the data cache, and the router cache.

**After:**
> Next.js caches data at request memoization, the data cache, and the router cache.

### 29. Fragmented headers

**Signs to watch:** a heading followed by a one-line paragraph that restates the heading before the real content begins.

**Problem:** A rhetorical warm-up after a heading adds nothing.

**Before:**
> ## Performance
>
> Speed matters.
>
> When users hit a slow page, they leave.

**After:**
> ## Performance
>
> When users hit a slow page, they leave.

---

## Rhetoric (30–36)

### 30. Forced metaphors and figurative overwriting

**Signs to watch:** strained or mixed metaphors, a metaphor explained immediately after it is used, figurative substitution where a plain word is clearer

**Problem:** Decorative imagery that adds no meaning. If the metaphor does not earn its place, cut it and say the literal thing.

**Before:**
> The codebase is a garden we must tend, pruning dead branches and planting seeds of innovation so the whole ecosystem can flourish. In other words, delete unused code and add features.

**After:**
> Delete unused code and add features.

### 31. Dramatic fragmentation and punchy kickers

**Signs to watch:** two- or three-word subjectless sentences used for drama, staccato "X. And Y. And Z." runs, a short quotable line ending every paragraph, cutesy appositive fragments

**Problem:** Ad-copy rhythm and mic-drop closers. One short sentence for emphasis is fine; a run of them is engineered. Distinct from pattern 13 (hidden actor).

**Before:**
> The catalog, honestly priced. Pay for what it does. Not promises. It just works. Every time.

**After:**
> The catalog is priced for what it does, not for promises.

### 32. Rhetorical questions answered immediately

**Signs to watch:** "What if...?", "The question is...", "Ever wondered...?", a question immediately followed by its own answer, "Think about it."

**Problem:** The question adds no information. State the point. Do not add questions to "sound human." Keep a question only if it was already in the source and is not answered in the next beat.

**Before:**
> What makes an API good? It comes down to predictability. Think about it: developers want to know exactly what they will get back.

**After:**
> A good API is predictable, so developers know exactly what they will get back.

### 33. Sentence-opener tics

**Words to watch:** So..., Look,, Honestly? as a standalone hook, habitual stacked sentence-initial And/But, "I think"/"I believe" when stating a fact, adverb openers (Interestingly, Importantly, Notably, Crucially, Essentially, Ultimately)

**Problem:** Theatrical openers that fake warmth or tell the reader how to feel. One And/But, or "honestly" mid-sentence, is not a tell. Do not insert And/But or "I think" on purpose.

**Before:**
> So, the results were mixed. Interestingly, adoption went up. Importantly, churn went up too. I think that means the feature still needs work.

**After:**
> The results were mixed: adoption rose, but churn rose alongside it, so the feature still needs work.

### 34. Reassurance kickers

**Signs to watch:** And that's okay., And that's fine., There's nothing wrong with that., no shame in..., you're not alone, it's completely normal

**Problem:** Softening the reader never asked for. Make the point and stop.

**Before:**
> You might not have a testing setup yet. And that's okay. Plenty of teams start without one, and there's nothing wrong with that.

**After:**
> Many teams start without a testing setup.

### 35. Diff-anchored writing

**Problem:** Documentation or comments written as if narrating a change rather than describing the thing as it is. Unless the document is a changelog, release note, or migration guide, it should read without knowing what changed in the last commit.

**Before:**
> This function was added to replace the previous approach of iterating through all items, which caused O(n²) performance.

**After:**
> This function does not iterate through all items. That approach was O(n²).

### 36. Aphorism formulas

**Words to watch:** X is the Y of Z, X becomes a trap, X is not a tool but a mirror, the language of, the currency of, the architecture of

**Problem:** Ordinary claims get turned into reusable profundities. Replace the formula with the concrete claim.

**Before:**
> Symmetry is the language of trust. Efficiency becomes a trap when teams forget the human layer.

**After:**
> Symmetry often reads as trust. Efficiency becomes a problem when teams forget the people in the system.
