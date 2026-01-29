# Domain Pitfalls: AI-Powered Exam Grading Platform

**Domain:** Educational technology - AI grading system
**Researched:** 2026-01-28
**Confidence:** MEDIUM-HIGH (verified with official sources and recent research)

## Critical Pitfalls

Mistakes that cause rewrites, major user trust issues, or system failures.

---

### Pitfall 1: Inconsistent AI Grading Across Similar Answers

**What goes wrong:** The LLM produces different scores for nearly identical student answers, or grades the same answer differently when re-evaluated. This destroys teacher and student trust in the system.

**Why it happens:**
- Using default temperature settings (typically 1.0) introduces randomness
- Lack of deterministic prompt engineering
- Model hallucinations persist even in 2026 (GPT-5 still hallucinates despite improvements)
- Rubric ambiguity that leaves interpretation to the model

**Consequences:**
- Students appeal grades, claiming unfairness
- Teachers lose confidence and abandon the system
- Legal/administrative challenges from parents
- Reputation damage

**Prevention:**
- **Set temperature to 0.0 for grading** - Research shows at temperature 0.0, responses are 100% identical across runs
- **Use structured output formats** with low-precision scales (0-3 or binary) rather than high-precision (0-100)
- **Implement question-specific rubrics** - General rubrics fail to capture nuances
- **Add few-shot examples** in prompts showing desired grading for each score level
- **Use chain-of-thought reasoning** before final scores
- **Log all grading decisions** with timestamps and model versions for audit trails

**Detection warning signs:**
- Teachers report "this shouldn't have gotten this score"
- Same answer graded differently on refresh
- Wide score variance on similar quality answers

**Phase impact:** Core grading engine (Phase 2-3). Must be addressed early as retrofitting consistency is difficult.

**Confidence:** HIGH - Verified with [temperature research](https://www.medrxiv.org/content/10.1101/2025.06.04.25328288v2.full) and [grading best practices](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/)

---

### Pitfall 2: OpenAI API Rate Limits and Quota Exhaustion

**What goes wrong:** When a teacher grades 30 exams at once, the system hits rate limits (429 errors) or exhausts API quota, causing some answers to fail grading without user awareness.

**Why it happens:**
- Not implementing exponential backoff retry logic
- Ignoring rate limit headers (x-ratelimit-remaining-requests)
- No queue system for batch grading
- Poor error handling that silently fails

**Consequences:**
- Some students get "Error: Not graded" on their reports
- Teacher sees incomplete results without knowing which failed
- Users retry, making the problem worse
- System appears broken during high-usage periods (end of semester)

**Prevention:**
- **Implement exponential backoff with jitter** - Wait 1s, 2s, 4s, 8s on 429 errors
- **Use Tenacity or Backoff libraries** for automatic retry with exponential backoff (1-60s waits, max 6 attempts)
- **Monitor rate limit headers** in responses: x-ratelimit-limit-requests, x-ratelimit-remaining-requests, retry-after
- **Implement queue system** for batch grading (grade 3-5 at a time, not all 30 simultaneously)
- **Show progress UI** with clear "X of Y graded" counter
- **Calculate token usage ahead** to estimate if batch will hit TPM limits
- **Cache rubric/instructions** to reduce redundant tokens
- **Fail gracefully** with specific error messages: "Rate limit reached. Retrying in 5 seconds..."

**Detection warning signs:**
- Intermittent failures during batch operations
- 429 error codes in logs
- Some answers graded, others not, with no clear pattern

**Phase impact:** API integration layer (Phase 2). Critical to implement before batch grading feature.

**Confidence:** HIGH - Verified with [OpenAI rate limits documentation](https://platform.openai.com/docs/guides/rate-limits) and [best practices](https://cookbook.openai.com/examples/how_to_handle_rate_limits)

---

### Pitfall 3: Database Locked Errors with SQLite Concurrency

**What goes wrong:** Multiple simultaneous grading requests cause "database is locked" errors, especially in FastAPI's async environment. Requests fail or timeout waiting for database access.

**Why it happens:**
- SQLite uses file-level locking - only ONE writer at a time
- FastAPI's async nature conflicts with SQLite's synchronous blocking
- Not configuring `check_same_thread: False`
- Using sync SQLAlchemy with async FastAPI endpoints

**Consequences:**
- Intermittent failures during concurrent teacher usage
- Slow response times as requests queue
- Failed writes with cryptic database errors
- System unusable during peak usage (multiple teachers grading)

**Prevention:**
- **Set connect_args={'check_same_thread': False}** in SQLAlchemy engine config
- **Enable WAL mode** (Write-Ahead Logging): `PRAGMA journal_mode=WAL`
- **Use async SQLAlchemy** with create_async_engine and AsyncSession
- **Implement connection pooling** with NullPool for SQLite
- **Add database timeout**: `timeout=30` in connection string
- **Plan migration to PostgreSQL** for production if >5 concurrent users expected
- **Keep write transactions short** - commit quickly to release locks
- **Add retry logic** specifically for database lock errors

**Detection warning signs:**
- "database is locked" in error logs
- Slow performance when multiple users active
- Timeouts during concurrent operations

**Phase impact:** Database layer (Phase 1-2). Address early as retrofitting is disruptive.

**Confidence:** HIGH - Verified with [SQLite concurrency patterns](https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/) and [FastAPI async patterns](https://medium.com/@mojimich2015/sqlalchemy-database-locks-using-fastapi-a-simple-guide-3e7dcd552d87)

**Production note:** SQLite throughput remains flat at ~150k rows/sec regardless of concurrent writers. For production with >10 concurrent teachers, migrate to PostgreSQL.

---

### Pitfall 4: PDF Generation Memory Exhaustion and Slow Performance

**What goes wrong:** Generating PDFs for 30+ page reports (with student answers, rubrics, explanations) causes memory errors or takes 30+ seconds per PDF, making batch report generation unusable.

**Why it happens:**
- Loading entire PDF into memory before writing
- Not using incremental page writing
- Uncompressed images in reports
- Complex layouts forcing recalculations

**Consequences:**
- Server crashes during batch PDF generation
- Users wait minutes for reports
- Out of memory errors
- Poor user experience

**Prevention:**
- **Use ReportLab with streaming/incremental writing** - write pages to disk instead of memory
- **Use Python generators** for data processing (lazy evaluation)
- **Compress images** before adding to PDF
- **Use simple layouts** - avoid complex nested tables
- **Set reasonable page limits** (max 50 pages per report)
- **Generate PDFs asynchronously** with background tasks (Celery or FastAPI BackgroundTasks)
- **Show progress indicator**: "Generating report... 1 of 30"
- **Consider HTML→PDF** alternatives (WeasyPrint) if ReportLab is too complex

**Detection warning signs:**
- Server memory spikes during PDF generation
- Slow response times (>10s per PDF)
- Out of memory errors in logs

**Phase impact:** Report generation feature (Phase 4). Plan architecture early even if implemented later.

**Confidence:** HIGH - Verified with [Python PDF library comparison](https://www.nutrient.io/blog/top-10-ways-to-generate-pdfs-in-python/) and [common problems](https://apitemplate.io/blog/a-guide-to-generate-pdfs-in-python/)

---

### Pitfall 5: CORS Middleware Ordering Breaking FastAPI + React Integration

**What goes wrong:** React frontend gets CORS errors even after adding CORSMiddleware to FastAPI. Errors persist mysteriously, especially on server errors or OPTIONS requests.

**Why it happens:**
- CORSMiddleware not added FIRST in middleware stack
- Origin mismatch (http vs https, port differences, trailing slash)
- Using wildcard "*" with allow_credentials=True (browsers reject this)
- Server errors (500) terminate before CORS headers added

**Consequences:**
- Frontend can't communicate with API
- Cryptic browser errors that non-technical users don't understand
- Development works but production fails (http vs https)
- Wasted debugging time

**Prevention:**
- **Add CORSMiddleware FIRST** - it must wrap all other middleware
- **Exact origin matching** in allow_origins list (check for typos, http vs https, ports)
- **Don't use wildcard in production** - specify exact origins
- **Enable all needed methods**: allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
- **Enable credentials if needed**: allow_credentials=True (but not with wildcard)
- **Set allow_headers=["*"]** or specify exact headers
- **Test from production domain** before launch
- **Restart server after changes** (surprisingly common mistake)

**Example config:**
```python
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Add CORS middleware FIRST
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Exact match, no wildcards
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Other middleware comes after
```

**Detection warning signs:**
- "No 'Access-Control-Allow-Origin' header" in browser console
- OPTIONS requests failing
- Works in development, fails in production

**Phase impact:** API setup (Phase 1). Must be correct from day one.

**Confidence:** HIGH - Verified with [FastAPI CORS documentation](https://fastapi.tiangolo.com/tutorial/cors/) and [common mistakes](https://davidmuraya.com/blog/fastapi-cors-configuration/)

---

### Pitfall 6: ReportLab Unicode Font Rendering Failures

**What goes wrong:** Student names with accented characters (José, Müller, 李明) or special symbols in answers render as boxes or cause crashes in PDF reports.

**Why it happens:**
- Default ReportLab fonts don't support full Unicode
- Not embedding fonts that support required character sets
- Mixing UTF-8 and non-UTF-8 encoding

**Consequences:**
- Names display incorrectly in reports
- International students' reports are broken
- Math symbols (∫, Σ, π) don't render
- Professional embarrassment

**Prevention:**
- **Always use UTF-8 encoding** for all text input
- **Embed Unicode-capable fonts** (DejaVu Sans, Arial Unicode MS, Noto Sans)
- **Test with international characters** early in development
- **Use font fallback** - ReportLab attempts Symbol/ZapfDingbats for missing chars
- **Validate character coverage** before production
- **Provide font configuration** option for admins

**Example:**
```python
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Register Unicode font
pdfmetrics.registerFont(TTFont('DejaVu', 'DejaVuSans.ttf'))

# Use in styles
styles = getSampleStyleSheet()
styles['Normal'].fontName = 'DejaVu'
```

**Detection warning signs:**
- Characters render as boxes/squares
- UnicodeDecodeError exceptions
- Reports work for "John Smith" but fail for "José García"

**Phase impact:** PDF generation (Phase 4). Test early with diverse character sets.

**Confidence:** MEDIUM - Based on [ReportLab font documentation](https://docs.reportlab.com/reportlab/userguide/ch3_fonts/) and [Unicode issues](https://groups.google.com/g/reportlab-users/c/_t11MUnyQs4)

---

### Pitfall 7: No Accessibility Compliance for April 2026 ADA Deadline

**What goes wrong:** Educational platform fails to meet WCAG 2.1 Level AA standards required by April 24, 2026 for public institutions, risking legal action and excluding disabled users.

**Why it happens:**
- Accessibility treated as "nice to have" instead of requirement
- No testing with screen readers or keyboard navigation
- Missing alt text for images
- Poor color contrast
- Forms not keyboard accessible

**Consequences:**
- Legal liability under ADA Title II (DOJ can enforce)
- Public institutions can't legally use the platform after April 2026
- Excluding disabled students and teachers
- Reputation damage
- Expensive retrofitting

**Prevention:**
- **Alt text for all images** (exam diagrams, rubric icons)
- **4.5:1 minimum contrast ratio** for text and UI elements
- **Keyboard navigation** for all functionality (no mouse required)
- **ARIA labels** for dynamic content
- **Form labels** properly associated with inputs
- **Screen reader testing** with NVDA or JAWS
- **Use semantic HTML** (button, nav, main, article)
- **Automated testing** with axe-core, Lighthouse, WAVE
- **Manual testing checklist** before each release

**WCAG 2.1 Level AA requirements:**
- Alternative text for images
- Captions for video/audio
- Keyboard accessible
- 4.5:1 contrast ratio (text)
- 3:1 contrast ratio (UI components)
- No keyboard traps
- Page titles
- Focus visible

**Detection warning signs:**
- Can't navigate without mouse
- Screen readers announce gibberish
- Low Lighthouse accessibility score (<90)

**Phase impact:** ALL phases. Must be built-in from start, not bolted on later.

**Deadline:** April 24, 2026 for public institutions (50,000+ population)

**Confidence:** HIGH - Verified with [DOJ ADA Title II rule](https://agb.org/news/agb-alerts/agb-policy-alert-ada-digital-accessibility-rule-requires-full-compliance-by-april-2026/) and [WCAG requirements](https://onlinelearningconsortium.org/olc-insights/2025/09/federal-digital-a11y-requirements/)

---

## Moderate Pitfalls

Mistakes that cause delays, user frustration, or technical debt.

---

### Pitfall 8: Poor Rubric Design UI Leading to Ineffective Grading

**What goes wrong:** Teachers create vague rubrics that produce inconsistent AI grading. UI doesn't guide them to create effective, specific criteria.

**Why it happens:**
- Allowing open-text rubric entry without structure
- No examples of good vs bad rubrics
- Missing guidance on question-specific rubrics
- Not enforcing low-precision scales

**Consequences:**
- Inconsistent grading (see Pitfall 1)
- Teacher frustration with results
- Time wasted tweaking rubrics post-grading

**Prevention:**
- **Provide rubric templates** by subject (math, essay, short answer)
- **Guide low-precision scales**: "Use 0-3 instead of 0-100 for better consistency"
- **Show examples** for each score level in rubric
- **Require specific criteria**: "What makes this a 3? What makes this a 2?"
- **Validate rubric quality** before grading (check for vague terms)
- **Allow testing** on sample answer before grading full exam
- **Provide iterative refinement** UI: generate → review → adjust → regenerate

**Best practice guidance:**
- Use 0-3 or 0-4 scales instead of 0-10 or 0-100
- Provide description for EACH score level
- Include 1-2 example answers for each score
- Make criteria measurable, not subjective
- Question-specific rubrics outperform general rubrics

**Detection warning signs:**
- Teachers constantly editing rubrics after grading
- High variance in AI grades for similar answers
- Teachers report "AI doesn't get it"

**Phase impact:** Rubric creation UI (Phase 2). Core to system effectiveness.

**Confidence:** HIGH - Verified with [LLM rubric best practices](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/) and [question-specific research](https://arxiv.org/html/2503.23989v1)

---

### Pitfall 9: Missing Autosave Causing Student Work Loss

**What goes wrong:** Student spends 30 minutes answering exam questions. Browser crashes or network drops. All answers lost. Student furious.

**Why it happens:**
- No autosave implementation
- Autosave triggers too frequently (performance issues)
- Form state not persisted to backend
- Not using localStorage as backup

**Consequences:**
- Student work loss
- Complaints and support burden
- Students afraid to use platform
- Lost trust

**Prevention:**
- **Implement debounced autosave** (save 2-3 seconds after typing stops)
- **Use localStorage backup** for offline resilience
- **Show save status**: "Saving..." → "Saved at 2:34 PM"
- **Warn on navigation**: "You have unsaved changes"
- **Test with network failures** (simulate offline)
- **Set Form resetOptions: keepDirtyValues: true** to prevent data loss during autosave
- **Clear timeout on unmount** to prevent multiple save attempts
- **Handle save failures gracefully**: "Failed to save. Retry?"

**React implementation considerations:**
```javascript
// Debounce autosave to avoid save on every keystroke
const debouncedSave = useDebounce(formData, 2000);

useEffect(() => {
  // Save to backend
  autosave(debouncedSave);

  // Also save to localStorage as backup
  localStorage.setItem('exam-draft', JSON.stringify(debouncedSave));
}, [debouncedSave]);
```

**Detection warning signs:**
- User complaints about lost work
- No "last saved" indicator in UI
- No warning on browser close

**Phase impact:** Student exam interface (Phase 3). Critical for user trust.

**Confidence:** MEDIUM - Based on [React autosave patterns](https://www.codemzy.com/blog/autosave-reactjs-with-setinterval) and [common mistakes](https://github.com/orgs/react-hook-form/discussions/8535)

---

### Pitfall 10: No Streaming for Long Grading Operations

**What goes wrong:** Teacher clicks "Grade Exam" and sees loading spinner for 60+ seconds with no feedback. Assumes it's broken and refreshes, restarting the process.

**Why it happens:**
- Not implementing OpenAI streaming API
- Blocking on full response before showing any feedback
- No progress indicators

**Consequences:**
- Users think system is broken
- Wasted API calls from impatient refreshes
- Poor user experience
- Support burden

**Prevention:**
- **Use OpenAI streaming API** for real-time feedback
- **Show token generation**: "Grading question 1... analyzing answer..."
- **Progress bar for batch grading**: "Grading 5 of 30 exams"
- **Set client timeout to 600+ seconds** to avoid premature timeouts
- **Display incremental results** as they arrive
- **Fail fast detection**: If no tokens after 5-6 seconds, warn user

**Benefits of streaming:**
- Tokens arrive within 5-6 seconds (early timeout detection)
- User sees progress instead of blank screen
- Can cancel long-running requests
- Better UX perception of speed

**Detection warning signs:**
- Users complain about "system hanging"
- High rate of duplicate API calls
- Timeout errors in logs

**Phase impact:** Grading UI (Phase 3). Significant UX improvement.

**Confidence:** HIGH - Verified with [OpenAI streaming docs](https://platform.openai.com/docs/guides/streaming-responses) and [timeout best practices](https://medium.com/@puneet1337/how-to-fix-openai-rate-limits-timeout-errors-cd3dc5ddd50b)

---

### Pitfall 11: FERPA Compliance Violations with Student Data

**What goes wrong:** System logs student personally identifiable information (PII) in plain text, stores answers in browser localStorage indefinitely, or sends data to OpenAI without proper data processing agreement.

**Why it happens:**
- Not understanding FERPA requirements
- Logging student data for debugging
- Using third-party services without data agreements
- No data retention policy

**Consequences:**
- FERPA violations (loss of federal funding)
- Legal liability
- Parent complaints
- Institutional non-adoption
- Privacy breaches

**Prevention:**
- **Understand FERPA scope**: Applies to ANY educational institution receiving federal funds
- **Minimize PII in logs**: Log student IDs, not names/emails
- **Encrypt data at rest**: Especially in database
- **Secure data in transit**: HTTPS everywhere
- **Data processing agreements** with ALL vendors (OpenAI, hosting provider)
- **Retention policy**: Delete old exam data after X months
- **Access controls**: Only authorized users see student data
- **Audit logs**: Track who accessed what student data
- **Don't send PII to analytics**: Scrub before sending to external services
- **Parent consent forms** for data collection (if under 18)

**FERPA requirements:**
- Student education records are confidential
- Disclosure requires written consent (with exceptions)
- Students/parents have right to access and amend records
- Vendors must meet "school official" criteria
- Vendors under direct control regarding data use

**Detection warning signs:**
- Student names/emails in application logs
- No encryption for database
- No vendor data processing agreements
- Indefinite data retention

**Phase impact:** Data architecture (Phase 1-2). Must be designed in from start.

**Confidence:** HIGH - Verified with [FERPA requirements](https://studentprivacy.ed.gov/ferpa) and [compliance guide](https://www.upguard.com/blog/ferpa-compliance-guide)

---

### Pitfall 12: Not Validating AI Grading Accuracy

**What goes wrong:** System deployed without testing if AI grades match human teacher grades. Later discover accuracy is only 60% on certain question types.

**Why it happens:**
- Assuming GPT-4/5 is "good enough" without testing
- No benchmark dataset of human-graded answers
- Not measuring accuracy, only deploying

**Consequences:**
- Poor grading quality discovered after launch
- Teacher distrust
- Student complaints
- Expensive post-launch fixes

**Prevention:**
- **Create benchmark dataset**: 50-100 teacher-graded answers
- **Measure accuracy metrics**:
  - Exact match rate
  - Within-1-point agreement rate
  - Correlation coefficient with human grades
- **Test across question types**: Multiple choice, short answer, essay
- **Establish threshold**: "Must achieve 85% within-1-point agreement"
- **Use rubric-based evaluation**: Check if AI identifies same criteria as humans
- **A/B test with teachers**: Have some review AI grades, measure agreement
- **Continuous monitoring**: Track grade distribution over time

**Evaluation framework:**
- Use GPT-4 or Claude 3.5 Sonnet as judge (high reliability)
- Calculate Non-Hallucination Rate: 1 - hallucination_rate
- Monitor Statistical Volatility Index (SVI) for consistency
- Track accuracy across demographic groups (bias detection)

**Detection warning signs:**
- Teachers override many AI grades
- Student appeals frequently successful
- Grade distribution doesn't match teacher expectations

**Phase impact:** Testing/QA (Phase 5). Should happen before production launch.

**Confidence:** MEDIUM-HIGH - Based on [AI evaluation best practices](https://freeplay.ai/blog/defining-the-right-evaluation-criteria-for-your-llm-project) and [benchmark standards](https://artificialanalysis.ai/methodology/intelligence-benchmarking)

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

---

### Pitfall 13: Poor Error Messages for Users

**What goes wrong:** User sees "Error 500" or "Something went wrong" without actionable guidance.

**Prevention:**
- Translate API errors to user-friendly messages
- Provide next steps: "Try again" vs "Contact support"
- Different messages for different error types
- Log detailed errors server-side, show simple messages client-side

**Example:**
```
Bad:  "Error: 429"
Good: "Grading limit reached. Retrying in 10 seconds..."

Bad:  "Database error"
Good: "Unable to save exam. Please check your connection and try again."
```

**Phase impact:** Error handling (all phases)

---

### Pitfall 14: No Exam Draft Preview Before Publishing

**What goes wrong:** Teacher creates exam with typos or wrong rubric settings. Only discovers after students start taking it.

**Prevention:**
- Provide preview mode that mimics student view
- Allow editing published exams (with versioning)
- Warn before publishing: "X students have already started"
- Test grading on sample answer before publishing

**Phase impact:** Exam creation UI (Phase 2)

---

### Pitfall 15: Missing Bulk Operations for Teachers

**What goes wrong:** Teacher must manually grade 30 exams one by one. Tedious and time-consuming.

**Prevention:**
- Batch grading: "Grade all ungraded exams"
- Bulk export: "Download all reports as ZIP"
- Bulk actions: Select multiple, apply action
- Progress tracking for long-running operations

**Phase impact:** Teacher dashboard (Phase 3-4)

---

### Pitfall 16: No Search or Filter on Large Exam Lists

**What goes wrong:** Teacher has 50 exams. Can't find the one they want.

**Prevention:**
- Search by name, date, subject
- Filter by status (draft, published, graded)
- Sort by various fields
- Pagination for large lists

**Phase impact:** Dashboard UI (Phase 3)

---

### Pitfall 17: Unclear Grading Explanation for Students

**What goes wrong:** Student sees score but doesn't understand why. AI explanation is too technical or vague.

**Prevention:**
- Structured feedback format:
  - "What you did well: ..."
  - "What needs improvement: ..."
  - "Specific suggestions: ..."
- Map feedback to rubric criteria
- Highlight which parts of answer were problematic
- Avoid AI jargon in student-facing text

**Phase impact:** Grading output formatting (Phase 3)

---

## Phase-Specific Warnings

| Phase | Component | Likely Pitfall | Mitigation |
|-------|-----------|---------------|------------|
| Phase 1 | FastAPI Setup | CORS misconfiguration | Add CORSMiddleware FIRST, exact origins |
| Phase 1 | Database | SQLite locking | Enable WAL mode, check_same_thread=False |
| Phase 1 | Data Model | Missing FERPA compliance | Design with privacy from start |
| Phase 2 | OpenAI Integration | Rate limiting | Implement exponential backoff, queue system |
| Phase 2 | Prompt Engineering | Inconsistent grading | Temperature=0.0, structured output |
| Phase 2 | Rubric UI | Poor teacher guidance | Templates, examples, validation |
| Phase 3 | Student Interface | Work loss | Autosave with debounce, localStorage backup |
| Phase 3 | Grading UI | Long waits with no feedback | Streaming API, progress indicators |
| Phase 3 | Batch Grading | API quota exhaustion | Queue system, rate limit monitoring |
| Phase 4 | PDF Generation | Memory exhaustion | Incremental writing, async generation |
| Phase 4 | Unicode Support | Character rendering | Embed Unicode fonts, test early |
| All Phases | Accessibility | WCAG 2.1 non-compliance | Built-in from start, automated testing |
| Phase 5 | Testing | No accuracy validation | Benchmark dataset, measure agreement |

---

## Technology-Specific Gotchas

### React + FastAPI Integration
1. **CORS errors** - Middleware ordering, origin mismatch
2. **Form state** - Missing autosave, not using controlled components
3. **Async operations** - Race conditions, stale closures

### OpenAI API
1. **Rate limits** - 429 errors without retry logic
2. **Temperature settings** - Default randomness ruins consistency
3. **Timeout handling** - Long requests without streaming
4. **Token counting** - Unexpected quota exhaustion

### SQLite
1. **Concurrent writes** - Database locked errors
2. **Async/sync mismatch** - Blocking in async context
3. **Production scalability** - Single-writer bottleneck

### PDF Generation (ReportLab)
1. **Memory usage** - Loading entire PDF into memory
2. **Unicode fonts** - Character rendering failures
3. **Performance** - Slow generation for long reports
4. **Layout complexity** - Difficult to debug positioning issues

---

## Testing Checklist Before Launch

### AI Grading Quality
- [ ] Temperature set to 0.0 for consistency
- [ ] Tested same answer 10 times, got identical scores
- [ ] Benchmark dataset: 50+ teacher-graded examples
- [ ] Accuracy >85% within 1 point of human grades
- [ ] Tested across question types (MC, short answer, essay)

### Performance & Reliability
- [ ] Batch grading 30 exams completes without errors
- [ ] No database locked errors under concurrent load
- [ ] API rate limit handling with exponential backoff
- [ ] PDF generation completes in <10s per report
- [ ] Streaming shows feedback within 5-6 seconds

### User Experience
- [ ] Autosave prevents work loss
- [ ] Progress indicators for all long operations
- [ ] Error messages are user-friendly and actionable
- [ ] Keyboard navigation works for all features
- [ ] Screen reader announces content correctly

### Security & Compliance
- [ ] HTTPS everywhere
- [ ] No PII in application logs
- [ ] Database encrypted at rest
- [ ] FERPA-compliant data handling
- [ ] Vendor data processing agreements signed

### Accessibility (WCAG 2.1 Level AA)
- [ ] Alt text for all images
- [ ] 4.5:1 contrast ratio for text
- [ ] Keyboard accessible (no mouse required)
- [ ] ARIA labels for dynamic content
- [ ] Lighthouse accessibility score >90

### Edge Cases
- [ ] Unicode characters in names/answers
- [ ] Very long answers (2000+ words)
- [ ] Empty answers
- [ ] Network failures during submission
- [ ] Browser crash and recovery

---

## Red Flags During Development

**Stop and fix immediately if you see:**
- Same answer getting different scores on re-grade
- "Database is locked" in error logs
- CORS errors in browser console
- OpenAI 429 errors without retry
- Student data in plain text logs
- PDF generation >30 seconds
- No autosave implementation
- Lighthouse accessibility score <70
- No streaming for long operations

**These are NOT "we'll fix it later" issues. They indicate fundamental architectural problems.**

---

## Sources

### AI Grading & Consistency
- [AI Hallucination in 2026](https://blogs.library.duke.edu/blog/2026/01/05/its-2026-why-are-llms-still-hallucinating/)
- [GPT-4 Grading Consistency Research](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2023.1272229/full)
- [Temperature Impact on Accuracy](https://www.medrxiv.org/content/10.1101/2025.06.04.25328288v2.full)
- [LLM Rubric Best Practices](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/)
- [Question-Specific Rubrics Research](https://arxiv.org/html/2503.23989v1)
- [Reflective Prompt Engineering](https://www.tandfonline.com/doi/full/10.1080/09500693.2025.2523571)

### OpenAI API
- [Rate Limits Guide](https://platform.openai.com/docs/guides/rate-limits)
- [Error Handling Cookbook](https://cookbook.openai.com/examples/how_to_handle_rate_limits)
- [Streaming API Docs](https://platform.openai.com/docs/guides/streaming-responses)
- [Timeout Best Practices](https://medium.com/@puneet1337/how-to-fix-openai-rate-limits-timeout-errors-cd3dc5ddd50b)

### FastAPI + React
- [CORS Configuration](https://fastapi.tiangolo.com/tutorial/cors/)
- [CORS Common Mistakes](https://davidmuraya.com/blog/fastapi-cors-configuration/)
- [React Autosave Patterns](https://www.codemzy.com/blog/autosave-reactjs-with-setinterval)

### SQLite & Databases
- [SQLite Concurrent Writes](https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/)
- [FastAPI Async SQLite](https://medium.com/@mojimich2015/sqlalchemy-database-locks-using-fastapi-a-simple-guide-3e7dcd552d87)
- [SQLite Performance Limits](https://turso.tech/blog/beyond-the-single-writer-limitation-with-tursos-concurrent-writes)

### PDF Generation
- [Python PDF Libraries Comparison 2025](https://www.nutrient.io/blog/top-10-ways-to-generate-pdfs-in-python/)
- [PDF Generation Common Problems](https://apitemplate.io/blog/a-guide-to-generate-pdfs-in-python/)
- [ReportLab Font Documentation](https://docs.reportlab.com/reportlab/userguide/ch3_fonts/)
- [Unicode Issues](https://groups.google.com/g/reportlab-users/c/_t11MUnyQs4)

### Accessibility & Compliance
- [ADA Title II 2026 Deadline](https://agb.org/news/agb-alerts/agb-policy-alert-ada-digital-accessibility-rule-requires-full-compliance-by-april-2026/)
- [WCAG 2.1 Requirements](https://onlinelearningconsortium.org/olc-insights/2025/09/federal-digital-a11y-requirements/)
- [FERPA Compliance Guide](https://www.upguard.com/blog/ferpa-compliance-guide)
- [Student Privacy Requirements](https://studentprivacy.ed.gov/ferpa)

### AI Evaluation & Testing
- [AI Model Benchmarks 2026](https://artificialanalysis.ai/methodology/intelligence-benchmarking)
- [LLM Evaluation Tools](https://medium.com/online-inference/the-best-llm-evaluation-tools-of-2026-40fd9b654dce)
- [Evaluation Best Practices](https://freeplay.ai/blog/defining-the-right-evaluation-criteria-for-your-llm-project)

### Educational Technology
- [AI Grading Tools 2026](https://www.jotform.com/ai/agents/ai-grading-tools/)
- [AI Cheating Detection Concerns](https://www.allaboutai.com/resources/ai-statistics/ai-cheating-in-schools/)
- [Exam Interface UX Design](https://medium.com/@diksha.saxena78/designing-a-complete-online-examination-portal-from-scratch-ui-ux-case-study-c58fda5764d4)

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|-----------|--------|
| AI Grading Consistency | HIGH | Verified with recent 2026 research and official documentation |
| OpenAI API Handling | HIGH | Official docs and cookbooks |
| FastAPI + React Integration | HIGH | Official docs and community patterns |
| SQLite Limitations | HIGH | Technical documentation and benchmark data |
| PDF Generation | MEDIUM-HIGH | Library docs and community experience |
| Accessibility | HIGH | Federal regulations and WCAG standards |
| FERPA Compliance | HIGH | Official government resources |
| UX Pitfalls | MEDIUM | Industry best practices and case studies |

## Overall Assessment

**Confidence: MEDIUM-HIGH**

This research is based on:
- Official documentation (OpenAI, FastAPI, WCAG)
- Recent 2026 research papers and studies
- Federal regulations (ADA, FERPA)
- Community best practices and real-world issues

Areas marked LOW confidence or requiring deeper research:
- None identified - all critical areas have HIGH or MEDIUM-HIGH confidence

**Recommendation:** This pitfall catalog is production-ready. Use it to inform phase planning and architecture decisions.
