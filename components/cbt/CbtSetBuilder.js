"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ImagePlus, Loader2, Merge, Plus, RotateCcw, Scissors, Trash2, Upload, X } from "lucide-react";
import Toast from "@/components/ui/Toast";
import { compressImage } from "@/lib/imageCompression";
import { MAX_IMAGES_PER_RUN, applyAnswerKey, parseAnswerKeyText, questionFlags } from "@/lib/cbtSetShared";

const ACCEPT = "image/jpeg,image/png,image/webp";
const EXTRACT_CONCURRENCY = 2;
const BLOCKING_FLAGS = new Set(["Empty text", "Missing options", "Invalid number", "Duplicate number"]);

const STATUS_LABEL = { compressing: "Queued", queued: "Queued", extracting: "Extracting", done: "Done", error: "Failed" };

let uidCounter = 0;
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${(uidCounter += 1)}`;

function blankOptions() {
  return ["A", "B", "C", "D"].map((key) => ({ key, text: "" }));
}

function toEditable(extracted, cardId) {
  return {
    uid: uid("q"),
    number: extracted.number,
    text: extracted.text,
    passage: extracted.passage || "",
    explanation: "",
    options: extracted.options.length ? extracted.options : blankOptions(),
    hasFigure: extracted.has_figure,
    attachSource: extracted.has_figure,
    sourceIds: cardId ? [cardId] : [],
    correctKey: "",
    keyStatus: ""
  };
}

function joinText(a, b) {
  return [a, b].map((value) => String(value || "").trim()).filter(Boolean).join("\n");
}

// Folds `incoming` into `target`: one question spanning two images arrives as two parts.
function mergeInto(target, incoming) {
  const options = [...target.options.filter((option) => option.text.trim())];
  for (const option of incoming.options) {
    if (option.text.trim() && !options.some((existing) => existing.key === option.key)) options.push(option);
  }
  return {
    ...target,
    text: joinText(target.text, incoming.text),
    passage: target.passage || incoming.passage,
    explanation: joinText(target.explanation, incoming.explanation),
    options: options.length ? options.sort((a, b) => a.key.localeCompare(b.key)) : target.options,
    hasFigure: target.hasFigure || incoming.hasFigure,
    attachSource: target.attachSource || incoming.attachSource,
    sourceIds: [...new Set([...target.sourceIds, ...incoming.sourceIds])],
    correctKey: target.correctKey || incoming.correctKey
  };
}

// Merges extracted questions (cards in upload order) into the current list by question number.
// Number 0 means "continuation whose number is not visible": it joins the last question touched.
function mergeExtraction(current, cardResults) {
  const list = [...current];
  let lastIndex = list.length - 1;
  for (const { cardId, questions } of cardResults) {
    for (const extracted of questions) {
      const incoming = toEditable(extracted, cardId);
      const sameNumber = extracted.number > 0 ? list.findIndex((question) => question.number === extracted.number) : -1;
      const targetIndex = extracted.number === 0 ? lastIndex : sameNumber;
      if (targetIndex >= 0) {
        list[targetIndex] = mergeInto(list[targetIndex], incoming);
        lastIndex = targetIndex;
      } else {
        list.push(incoming);
        lastIndex = list.length - 1;
      }
    }
  }
  return list;
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  async function next() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
}

async function postForm(url, form) {
  const response = await fetch(url, { method: "POST", body: form });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

export default function CbtSetBuilder({ exams, branches, subjects, initialSets }) {
  const [meta, setMeta] = useState({ title: "", examId: exams[0]?.id || "", branchId: "", subjectId: "", year: "", isPublished: false });
  const [cards, setCards] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [keyText, setKeyText] = useState("");
  const [keyCounts, setKeyCounts] = useState(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [sets, setSets] = useState(initialSets);
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [toast, setToast] = useState(null);
  const [dragging, setDragging] = useState(false);
  const dismissToast = useCallback(() => setToast(null), []);
  const fileInput = useRef(null);
  const keyFileInput = useRef(null);
  const cursorByQuestion = useRef(new Map());
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  // Release preview object URLs when the builder unmounts.
  useEffect(() => () => cardsRef.current.forEach((card) => card.previewUrl && URL.revokeObjectURL(card.previewUrl)), []);

  const branchOptions = branches.filter((branch) => branch.exam_id === meta.examId);
  const subjectOptions = subjects.filter((subject) => subject.branch_id === meta.branchId);
  const busy = cards.some((card) => ["compressing", "queued", "extracting"].includes(card.status));

  const duplicateNumbers = useMemo(() => {
    const seen = new Set();
    const duplicates = new Set();
    for (const question of questions) {
      if (seen.has(question.number)) duplicates.add(question.number);
      seen.add(question.number);
    }
    return duplicates;
  }, [questions]);

  const flagsByUid = useMemo(() => new Map(questions.map((question) => [question.uid, questionFlags(question, duplicateNumbers)])), [questions, duplicateNumbers]);
  const blockingCount = questions.filter((question) => flagsByUid.get(question.uid).some((flag) => BLOCKING_FLAGS.has(flag))).length;

  function updateCard(id, patch) {
    setCards((current) => current.map((card) => card.id === id ? { ...card, ...patch } : card));
  }

  function updateQuestion(questionUid, patch) {
    setQuestions((current) => current.map((question) => question.uid === questionUid ? { ...question, ...patch } : question));
  }

  async function extractCards(batch) {
    const results = new Map();
    await runPool(batch, EXTRACT_CONCURRENCY, async (card) => {
      updateCard(card.id, { status: "extracting", error: "" });
      try {
        const form = new FormData();
        form.append("image", card.file, card.name);
        const payload = await postForm("/api/admin/cbt-sets/extract", form);
        results.set(card.id, payload.questions || []);
        updateCard(card.id, { status: "done", questionCount: payload.questions?.length || 0 });
      } catch (error) {
        updateCard(card.id, { status: "error", error: error.message || "Extraction failed." });
      }
    });
    const ordered = batch.filter((card) => results.has(card.id)).map((card) => ({ cardId: card.id, questions: results.get(card.id) }));
    if (ordered.length) setQuestions((current) => mergeExtraction(current, ordered));
  }

  async function addImages(fileList) {
    const files = Array.from(fileList || []).filter((file) => ACCEPT.split(",").includes(file.type));
    const room = MAX_IMAGES_PER_RUN - cards.length;
    if (files.length < (fileList?.length || 0)) setMessage("Only JPG, PNG and WEBP images are accepted.");
    if (room <= 0) return setMessage(`A run is limited to ${MAX_IMAGES_PER_RUN} images.`);
    if (files.length > room) setMessage(`Only the first ${room} image(s) were added: a run is limited to ${MAX_IMAGES_PER_RUN} images.`);
    const batch = files.slice(0, room).map((file) => ({ id: uid("img"), name: file.name, original: file, file: null, previewUrl: "", status: "compressing", error: "", questionCount: 0 }));
    setCards((current) => [...current, ...batch]);
    const ready = [];
    for (const card of batch) {
      try {
        const compressed = await compressImage(card.original);
        const previewUrl = URL.createObjectURL(compressed);
        Object.assign(card, { file: compressed, previewUrl, status: "queued" });
        updateCard(card.id, { file: compressed, previewUrl, status: "queued", original: null });
        ready.push(card);
      } catch (error) {
        updateCard(card.id, { status: "error", error: error.message || "Could not read this image." });
      }
    }
    if (ready.length) await extractCards(ready);
  }

  function removeCard(cardId) {
    const card = cards.find((item) => item.id === cardId);
    if (card?.previewUrl) URL.revokeObjectURL(card.previewUrl);
    setCards((current) => current.filter((item) => item.id !== cardId));
    setQuestions((current) => current.map((question) => ({ ...question, sourceIds: question.sourceIds.filter((id) => id !== cardId) })));
  }

  function addQuestion(cardId) {
    const highest = questions.reduce((max, question) => Math.max(max, question.number || 0), 0);
    setQuestions((current) => [...current, { ...toEditable({ number: highest + 1, text: "", options: [], passage: null, has_figure: false }, cardId), attachSource: false }]);
  }

  function mergeWithNext(questionUid) {
    setQuestions((current) => {
      const index = current.findIndex((question) => question.uid === questionUid);
      if (index < 0 || index === current.length - 1) return current;
      const merged = mergeInto(current[index], current[index + 1]);
      return [...current.slice(0, index), merged, ...current.slice(index + 2)];
    });
  }

  function split(questionUid) {
    setQuestions((current) => {
      const index = current.findIndex((question) => question.uid === questionUid);
      if (index < 0) return current;
      const question = current[index];
      const at = cursorByQuestion.current.get(questionUid) ?? Math.floor(question.text.length / 2);
      const highest = current.reduce((max, item) => Math.max(max, item.number || 0), 0);
      const first = { ...question, text: question.text.slice(0, at).trim(), options: blankOptions(), correctKey: "", keyStatus: "" };
      const second = { ...question, uid: uid("q"), number: highest + 1, text: question.text.slice(at).trim(), passage: "", explanation: "" };
      return [...current.slice(0, index), first, second, ...current.slice(index + 1)];
    });
  }

  function applyPairs(pairs) {
    if (!pairs.length) return setMessage("No answer pairs were found.");
    // Counts are derived from the same pure function, so computing them here and in the updater agrees.
    const { counts } = applyAnswerKey(questions, pairs);
    setQuestions((current) => applyAnswerKey(current, pairs).questions);
    setKeyCounts(counts);
    setMessage("");
    setToast({ tone: "success", text: "Answer key applied." });
  }

  async function uploadKeyFile(file) {
    if (!file) return;
    setKeyBusy(true);
    setMessage("Reading the answer key…");
    try {
      const upload = file.type === "application/pdf" ? file : await compressImage(file);
      const form = new FormData();
      form.append("file", upload, file.name);
      const payload = await postForm("/api/admin/cbt-sets/answer-key", form);
      applyPairs(payload.pairs || []);
    } catch (error) {
      setMessage(error.message || "Could not read the answer key.");
    } finally {
      setKeyBusy(false);
    }
  }

  function reset() {
    cards.forEach((card) => card.previewUrl && URL.revokeObjectURL(card.previewUrl));
    setCards([]);
    setQuestions([]);
    setKeyCounts(null);
    setKeyText("");
    setDraftId(crypto.randomUUID());
    setMeta((current) => ({ ...current, title: "" }));
  }

  async function saveSet() {
    if (saving) return;
    if (!meta.title.trim() || !meta.examId || !meta.branchId) return setMessage("Add a title, exam and branch before saving.");
    if (!questions.length) return setMessage("Add at least one question before saving.");
    if (blockingCount) return setMessage(`${blockingCount} question(s) still have empty text, missing options or a bad number.`);
    if (busy) return setMessage("Wait for extraction to finish before saving.");
    setSaving(true);
    try {
      const uploadable = cards.filter((card) => card.file);
      const paths = new Map();
      setMessage(`Uploading ${uploadable.length} source image(s)…`);
      await runPool(uploadable, 3, async (card) => {
        const form = new FormData();
        form.append("image", card.file, card.name);
        form.append("draftId", draftId);
        const payload = await postForm("/api/admin/cbt-sets/sources", form);
        paths.set(card.id, payload.path);
      });
      setMessage("Saving set…");
      const response = await fetch("/api/admin/cbt-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...meta,
          subjectId: meta.subjectId || null,
          year: meta.year ? Number(meta.year) : null,
          sourceImages: [...paths.values()],
          questions: questions.map((question) => ({
            number: question.number,
            text: question.text,
            passage: question.passage,
            explanation: question.explanation,
            hasFigure: question.hasFigure,
            imagePaths: question.attachSource ? question.sourceIds.map((id) => paths.get(id)).filter(Boolean) : [],
            correctKey: question.correctKey,
            options: question.options.filter((option) => option.text.trim())
          }))
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not save the set.");
      setSets((current) => [{ ...payload.set, year: meta.year || null, created_at: new Date().toISOString() }, ...current]);
      setMessage("");
      setToast({ tone: "success", text: `Set saved: "${payload.set.title}", ${payload.set.questionCount} questions.` });
      reset();
    } catch (error) {
      setMessage(error.message || "Could not save the set.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(set) {
    try {
      const response = await fetch(`/api/admin/cbt-sets/${set.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublished: !set.is_published }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not update the set.");
      setSets((current) => current.map((item) => item.id === set.id ? { ...item, is_published: payload.set.is_published } : item));
    } catch (error) {
      setMessage(error.message);
    }
  }

  const groups = [
    ...cards.map((card) => ({ card, items: questions.filter((question) => question.sourceIds[0] === card.id) })),
    { card: null, items: questions.filter((question) => !question.sourceIds.length || !cards.some((card) => card.id === question.sourceIds[0])) }
  ];

  return <div className="mt-10 space-y-8">
    <div className="panel grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-4"><h2 className="section-title sm:col-span-2 lg:col-span-4">Set details</h2>
      <label className="block text-sm sm:col-span-2 lg:col-span-4"><span className="field-label">Set title</span><input className="field" maxLength={250} required value={meta.title} onChange={(event) => setMeta({ ...meta, title: event.target.value })} /></label>
      <label className="block text-sm"><span className="field-label">Exam</span><select className="field" value={meta.examId} onChange={(event) => setMeta({ ...meta, examId: event.target.value, branchId: "", subjectId: "" })}><option value="">Select exam</option>{exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}</select></label>
      <label className="block text-sm"><span className="field-label">Branch</span><select className="field" value={meta.branchId} onChange={(event) => setMeta({ ...meta, branchId: event.target.value, subjectId: "" })}><option value="">Select branch</option>{branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      <label className="block text-sm"><span className="field-label">Subject (optional)</span><select className="field" value={meta.subjectId} onChange={(event) => setMeta({ ...meta, subjectId: event.target.value })}><option value="">No subject</option>{subjectOptions.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
      <label className="block text-sm"><span className="field-label">Year (optional)</span><input className="field" inputMode="numeric" max="2200" min="1900" type="number" value={meta.year} onChange={(event) => setMeta({ ...meta, year: event.target.value })} /></label>
      <label className="flex min-h-[44px] items-center gap-3 text-sm sm:col-span-2 lg:col-span-4"><input checked={meta.isPublished} className="h-4 w-4" type="checkbox" onChange={(event) => setMeta({ ...meta, isPublished: event.target.checked })} /><span>Publish to students when saved</span></label>
    </div>

    <section aria-labelledby="cbt-images-heading" className="panel p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="section-title" id="cbt-images-heading">Question images</h2>{cards.length ? <p className="tabular text-sm text-slate-400">{cards.length} of {MAX_IMAGES_PER_RUN} images, {questions.length} questions</p> : null}</div>
      <input ref={fileInput} accept={ACCEPT} className="sr-only" multiple tabIndex={-1} type="file" onChange={(event) => { addImages(event.target.files); event.target.value = ""; }} />
      <div
        className={`mt-4 flex flex-col items-center justify-center rounded-[12px] border border-dashed px-6 py-10 text-center transition-colors ${dragging ? "border-electric bg-electric/5" : "border-[color:var(--border-strong)]"}`}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => { event.preventDefault(); if (!dragging) setDragging(true); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); if (cards.length < MAX_IMAGES_PER_RUN && !saving) addImages(event.dataTransfer.files); }}
      >
        <ImagePlus aria-hidden="true" className="text-slate-400" size={22} strokeWidth={1.75} />
        <p className="mt-3 font-medium">Drop question images here, or choose files</p>
        <p className="mt-1 max-w-md text-sm text-slate-400">JPG, PNG or WEBP, up to {MAX_IMAGES_PER_RUN} per run. Images are resized in your browser to 2000px on the longest side before upload.</p>
        <button className="button-secondary mt-5" disabled={cards.length >= MAX_IMAGES_PER_RUN || saving} onClick={() => fileInput.current?.click()} type="button">Choose files</button>
      </div>
    </section>

    {questions.length || cards.length ? <div className="space-y-6">
      {groups.map(({ card, items }) => (card || items.length) ? <section className="panel grid gap-5 p-4 sm:p-5 lg:grid-cols-[240px_minmax(0,1fr)]" key={card?.id || "manual"}>
        <div className="lg:sticky lg:top-[calc(var(--header-h)+16px)] lg:self-start">
          {card ? <>
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[12px] border border-line bg-[color:var(--surface-sunken)]">{card.previewUrl ? <Image alt={`Source image ${card.name}`} className="object-contain" fill sizes="(min-width: 1024px) 260px, 100vw" src={card.previewUrl} unoptimized /> : <div className="flex h-full items-center justify-center text-slate-500"><Loader2 className="animate-spin" size={20} /></div>}</div>
            <p className="mt-2 truncate text-sm font-medium">{card.name}</p>
            <p className="mt-2 flex items-center gap-2 text-xs" role="status"><span className={`badge ${card.status === "error" ? "badge-danger" : card.status === "done" ? "badge-success" : ""}`}>{card.status === "extracting" || card.status === "compressing" ? <Loader2 aria-hidden="true" className="animate-spin" size={11} /> : card.status === "done" ? <Check aria-hidden="true" size={11} /> : card.status === "error" ? <X aria-hidden="true" size={11} /> : null}{STATUS_LABEL[card.status] || card.status}</span>{card.status === "done" ? <span className="tabular text-slate-400">{card.questionCount} question(s)</span> : null}</p>{card.status === "error" ? <p className="mt-2 text-xs leading-5 text-[color:var(--bad-fg)]">{card.error}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">{card.status === "error" && card.file ? <button className="button-secondary btn-sm" onClick={() => extractCards([card])} type="button"><RotateCcw size={13} /> Retry</button> : null}<button className="button-secondary btn-sm" onClick={() => addQuestion(card.id)} type="button"><Plus size={13} /> Add question</button><button className="button-secondary btn-sm" disabled={saving} onClick={() => removeCard(card.id)} type="button"><Trash2 size={13} /> Remove image</button></div>
          </> : <><p className="font-medium">Questions without a source image</p><button className="button-secondary btn-sm mt-3" onClick={() => addQuestion(null)} type="button"><Plus size={13} /> Add question</button></>}
        </div>
        <div className="min-w-0 space-y-4">{items.length ? items.map((question) => <QuestionEditor
          canMerge={questions[questions.length - 1]?.uid !== question.uid}
          flags={flagsByUid.get(question.uid) || []}
          key={question.uid}
          onChange={(patch) => updateQuestion(question.uid, patch)}
          onCursor={(position) => cursorByQuestion.current.set(question.uid, position)}
          onDelete={() => setQuestions((current) => current.filter((item) => item.uid !== question.uid))}
          onMerge={() => mergeWithNext(question.uid)}
          onSplit={() => split(question.uid)}
          question={question}
        />) : <p className="text-sm text-slate-500">{card?.status === "done" ? "No questions were found on this image. Add them by hand if needed." : "Questions from this image will appear here."}</p>}</div>
      </section> : null)}
    </div> : null}

    <section className="panel space-y-4 p-6">
      <div><h2 className="section-title">Answer key</h2><p className="mt-1 text-sm text-slate-400">Paste pairs such as &quot;1-B, 2-C, 3-A&quot;, or upload an image or PDF of the key. Unmatched and conflicting questions stay blank until you choose.</p></div>
      <label className="block"><span className="field-label">Paste the key</span><textarea className="field min-h-24 font-mono text-sm" placeholder={"1-B, 2-C, 3-A"} value={keyText} onChange={(event) => setKeyText(event.target.value)} /></label>
      <div className="flex flex-wrap gap-3">
        <button className="button-secondary" disabled={!keyText.trim() || !questions.length} onClick={() => applyPairs(parseAnswerKeyText(keyText))} type="button">Apply pasted key</button>
        <input ref={keyFileInput} accept={`${ACCEPT},application/pdf`} className="sr-only" type="file" onChange={(event) => { uploadKeyFile(event.target.files?.[0]); event.target.value = ""; }} />
        <button className="button-secondary" disabled={keyBusy || !questions.length} onClick={() => keyFileInput.current?.click()} type="button">{keyBusy ? <Loader2 className="animate-spin" size={15} /> : <Upload size={15} />} Upload key image or PDF</button>
      </div>
      {keyCounts ? <p className="tabular text-sm" role="status"><span className="text-[color:var(--ok-fg)]">{keyCounts.matched} matched</span>, <span className={keyCounts.unmatched ? "text-[color:var(--warn-fg)]" : "text-slate-400"}>{keyCounts.unmatched} unmatched</span>, <span className={keyCounts.conflicting ? "text-[color:var(--bad-fg)]" : "text-slate-400"}>{keyCounts.conflicting} {keyCounts.conflicting === 1 ? "conflict" : "conflicts"}</span>{keyCounts.unusedKeys ? <span className="text-slate-400">, {keyCounts.unusedKeys} keys with no question</span> : null}. Unmatched and conflicting questions stay blank until you choose.</p> : null}
    </section>

    <div className="sticky bottom-0 z-20 -mx-5 flex flex-col gap-3 border-t border-line bg-ink/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <p className="text-sm text-slate-400">{questions.length ? <><span className="tabular text-foreground">{questions.length} questions</span>{blockingCount ? <span className="text-[color:var(--bad-fg)]">, {blockingCount} need fixing</span> : null}, <span className="tabular">{questions.filter((question) => !question.correctKey).length}</span> without an answer key. Nothing is saved until you save the set.</> : "Add images or questions to build a set."}</p>
      <button className="button-primary" disabled={saving || busy || !questions.length} onClick={saveSet} type="button">{saving ? <><Loader2 aria-hidden="true" className="animate-spin" size={16} />Saving…</> : `Save ${questions.length} ${questions.length === 1 ? "question" : "questions"}`}</button>
    </div>
    {message ? <p className="text-sm text-slate-400" role="status">{message}</p> : null}
    <Toast onDismiss={dismissToast} toast={toast} />

    <div className="space-y-3">
      <h2 className="section-title">Saved sets</h2>
      {sets.length ? <div className="rows">{sets.map((set) => <div className="row flex-wrap" key={set.id}><div className="min-w-0 flex-1"><p className="truncate font-medium">{set.title}</p><p className="mt-1 flex flex-wrap gap-1.5">{set.year ? <span className="badge tabular">{set.year}</span> : null}<span className="badge tabular">{set.questionCount ?? set.cbt_questions?.[0]?.count ?? 0} questions</span><span className={`badge ${set.is_published ? "badge-success" : ""}`}>{set.is_published ? "Published" : "Draft"}</span></p></div><div className="flex gap-2">{set.is_published ? <a className="button-ghost btn-sm" href={`/cbt/${set.id}`}>Open</a> : null}<button className="button-secondary btn-sm" onClick={() => togglePublish(set)} type="button">{set.is_published ? "Unpublish" : "Publish"}</button></div></div>)}</div> : <div className="empty-state"><p className="font-medium">No sets saved yet</p><p className="mt-1 text-sm text-slate-400">Add question images above, review them, then save the set.</p></div>}
    </div>
  </div>;
}

function QuestionEditor({ question, flags, canMerge, onChange, onCursor, onDelete, onMerge, onSplit }) {
  function updateOption(index, patch) {
    onChange({ options: question.options.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option) });
  }
  function addOption() {
    const used = new Set(question.options.map((option) => option.key));
    const key = "ABCDEFGHIJ".split("").find((letter) => !used.has(letter));
    if (key) onChange({ options: [...question.options, { key, text: "" }] });
  }
  const trackCursor = (event) => onCursor(event.target.selectionStart);
  return <article className="rounded-[12px] border border-line bg-[color:var(--surface-sunken)] p-4">
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm"><span className="text-slate-400">No.</span><input aria-label="Question number" className="field w-20 py-1.5" min="1" type="number" value={Number.isFinite(question.number) ? question.number : ""} onChange={(event) => onChange({ number: event.target.value === "" ? NaN : Number(event.target.value) })} /></label>
      <div className="flex flex-wrap gap-1.5">{flags.map((flag) => <span className={`badge ${BLOCKING_FLAGS.has(flag) ? "badge-danger" : "text-[color:var(--warn-fg)]"}`} key={flag}><AlertTriangle size={11} />{flag}</span>)}</div>
      <div className="ml-auto flex flex-wrap gap-1.5">
        <button className="button-ghost btn-sm" disabled={!canMerge} onClick={onMerge} title="Merge with the next question" type="button"><Merge size={13} /> Merge next</button>
        <button className="button-ghost btn-sm" onClick={onSplit} title="Split the text at the cursor into a new question" type="button"><Scissors size={13} /> Split</button>
        <button className="button-danger btn-sm" onClick={onDelete} type="button"><Trash2 size={13} /> Delete</button>
      </div>
    </div>
    <label className="mt-3 block text-sm"><span className="field-label">Question text</span><textarea className="field min-h-24" value={question.text} onChange={(event) => onChange({ text: event.target.value })} onClick={trackCursor} onKeyUp={trackCursor} onSelect={trackCursor} /></label>
    <details className="mt-2 text-sm" open={Boolean(question.passage)}><summary className="cursor-pointer text-slate-400">Passage (optional)</summary><textarea className="field mt-2 min-h-20" value={question.passage} onChange={(event) => onChange({ passage: event.target.value })} /></details>
    <div className="mt-3 space-y-2">{question.options.map((option, index) => <div className="flex gap-2" key={index}><input aria-label="Option letter" className="field w-14 py-2 text-center uppercase" maxLength={1} value={option.key} onChange={(event) => updateOption(index, { key: event.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} /><input aria-label={`Option ${option.key} text`} className="field py-2" value={option.text} onChange={(event) => updateOption(index, { text: event.target.value })} /><button aria-label={`Remove option ${option.key}`} className="rounded-lg px-2 text-slate-500 hover:text-red-300" onClick={() => onChange({ options: question.options.filter((_, optionIndex) => optionIndex !== index) })} type="button"><Trash2 size={14} /></button></div>)}<button className="text-xs text-electric" onClick={addOption} type="button">+ Add option</button></div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="block text-sm"><span className="field-label">Correct option{question.keyStatus === "conflicting" ? ` (key says ${question.keyCandidates?.join(" / ")})` : question.keyStatus === "unmatched" ? " (not in key)" : ""}</span><select className="field" value={question.correctKey} onChange={(event) => onChange({ correctKey: event.target.value, keyStatus: event.target.value ? "chosen" : question.keyStatus })}><option value="">Not set</option>{question.options.filter((option) => option.key).map((option) => <option key={option.key} value={option.key}>{option.key}</option>)}</select></label>
      <label className="block text-sm"><span className="field-label">Explanation (optional)</span><input className="field" value={question.explanation} onChange={(event) => onChange({ explanation: event.target.value })} /></label>
    </div>
    <div className="mt-3 flex flex-wrap gap-4 text-sm">
      <label className="flex items-center gap-2"><input checked={question.hasFigure} className="h-4 w-4" type="checkbox" onChange={(event) => onChange({ hasFigure: event.target.checked, attachSource: event.target.checked || question.attachSource })} />Has figure</label>
      <label className={`flex items-center gap-2 ${question.sourceIds.length ? "" : "opacity-50"}`}><input checked={question.attachSource} className="h-4 w-4" disabled={!question.sourceIds.length} type="checkbox" onChange={(event) => onChange({ attachSource: event.target.checked })} />Show source image to students</label>
    </div>
  </article>;
}
