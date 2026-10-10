# Lumi demo knowledge-base contract

**Source:** User-provided `company_info.py` (not duplicated or modified by this pack). The original file contains `COMPANY_NAME`, `COMPANY_INFO`, and `SYSTEM_PROMPT`. Keep the source file in the project repository beside `chatbot.py`.

- Fictional organisation: Lumora Technologies Sdn. Bhd.; Employee Handbook **v3.2**, last updated **1 July 2026**.
- Lumi answers only from the embedded handbook, cites relevant sections, does not invent limits or contacts, and cannot access personal records or approve requests.
- Language: English, Malay or Chinese according to employee input. A cached English answer must not be blindly reused for a Malay/Chinese response.
- Cache-safe FAQ examples, **only when approved and context-independent**: core hours 10:00am–4:00pm; Team Day Tuesday; where to submit expense claims (LumoraHub > Claims); how to report phishing (Outlook Report Phishing button).
- Unsafe semantic-cache examples: 'How many annual leave days do I get?' (16/18/22 days by tenure); 'What is my remaining leave balance?'; 'What is my salary?'; 'Can I work abroad next month?' (needs approval and personal context); employee incident details; private HR/medical cases.
- Handbook change: invalidate all FAQ embeddings and response caches for the previous handbook version or content hash.
- The handbook contains a fictional EAP number and fictional `.example` contacts. They are test content, not real operational contacts.
- Do not conflate statutory law with handbook rules. TokenGuard optimises delivery of Lumi's handbook-based answers; it is not a legal compliance checker.
- Do not send raw handbook or employee chat text into analytics logs. The model provider still receives necessary context for uncached requests; clearly disclose the data flow in product UI.

## Required source-file presence check
Before coding: confirm `chatbot.py` and `company_info.py` exist. If not, ask the owner to add their originals. **Do not generate substitutes with guessed policies.**
