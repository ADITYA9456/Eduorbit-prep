"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ImagePlus, Loader2, Merge, Plus, RotateCcw, Scissors, Trash2, Upload } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";
import { MAX_IMAGES_PER_RUN, applyAnswerKey, parseAnswerKeyText, questionFlags } from "@/lib/cbtSetShared";

const ACCEPT = "image/jpeg,image/png,image/webp";
const EXTRACT_CONCURRENCY = 2;
const BLOCKING_FLAGS = new Set(["Empty text", "Missing options", "Invalid number", "Duplicate number"]);

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
    setMessage(`Answer key applied: ${counts.matched} matched, ${counts.unmatched} unmatched, ${counts.conflicting} conflicting.`);
  }

  async function uploadKeyFile(file) {
    if (!file) return;
    setKeyBusy(true);
    setMessage("Reading the answer key...");
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
      setMessage(`Uploading ${uploadable.length} source image(s)...`);
      await runPool(uploadable, 3, async (card) => {
        const form = new FormData();
        form.append("image", card.file, card.name);
        form.append("draftId", draftId);
        const payload = await postForm("/api/admin/cbt-sets/sources", form);
        paths.set(card.id, payload.path);
      });
      setMessage("Saving set...");
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
      setMessage(`Saved "${payload.set.title}" with ${payload.set.questionCount} questions.`);
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
    <div className="card grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
      <label className="block text-sm sm:col-span-2 lg:col-span-3"><span className="mb-2 block text-slate-400">Set title</span><input className="field" maxLength={250} required value={meta.title} onChange={(event) => setMeta({ ...meta, title: event.target.value })} /></label>
      <label className="block text-sm"><span className="mb-2 block text-slate-400">Exam</span><select className="field" value={meta.examId} onChange={(event) => setMeta({ ...meta, examId: event.target.value, branchId: "", subjectId: "" })}><option value="">Select exam</option>{exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}</select></label>
      <label className="block text-sm"><span className="mb-2 block text-slate-400">Branch</span><select className="field" value={meta.branchId} onChange={(event) => setMeta({ ...meta, branchId: event.target.value, subjectId: "" })}><option value="">Select branch</option>{branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      <label className="block text-sm"><span className="mb-2 block text-slate-400">Subject (optional)</span><select className="field" value={meta.subjectId} onChange={(event) => setMeta({ ...meta, subjectId: event.target.value })}><option value="">No subject</option>{subjectOptions.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
      <label className="block text-sm"><span className="mb-2 block text-slate-400">Year (optional)</span><input className="field" inputMode="numeric" max="2200" min="1900" type="number" value={meta.year} onChange={(event) => setMeta({ ...meta, year: event.target.value })} /></label>
      <label className="flex items-center gap-3 text-sm sm:col-span-2"><input checked={meta.isPublished} className="h-4 w-4" type="checkbox" onChange={(event) => setMeta({ ...meta, isPublished: event.target.checked })} /><span>Publish to students when saved</span></label>
    </div>

    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-semibold">Question images</h2><p className="mt-1 text-sm text-slate-500">JPG, PNG or WEBP, up to {MAX_IMAGES_PER_RUN} per run. Images are compressed in the browser (longest side 2000px) before upload.</p></div>
        <input ref={fileInput} accept={ACCEPT} className="sr-only" multiple type="file" onChange={(event) => { addImages(event.target.files); event.target.value = ""; }} />
        <button className="button-primary" disabled={cards.length >= MAX_IMAGES_PER_RUN || saving} onClick={() => fileInput.current?.click()} type="button"><ImagePlus size={16} /> Add images</button>
      </div>
      {cards.length ? <p className="mt-3 text-xs text-slate-500">{cards.length} / {MAX_IMAGES_PER_RUN} images · {questions.length} questions</p> : null}
    </div>

    {questions.length || cards.length ? <div className="space-y-6">
      {groups.map(({ card, items }) => (card || items.length) ? <section className="card grid gap-5 p-4 sm:p-5 lg:grid-cols-[260px_minmax(0,1fr)]" key={card?.id || "manual"}>
        <div className="lg:sticky lg:top-20 lg:self-start">
          {card ? <>
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-line bg-black/20">{card.previewUrl ? <Image alt={`Source image ${card.name}`} className="object-contain" fill sizes="(min-width: 1024px) 260px, 100vw" src={card.previewUrl} unoptimized /> : <div className="flex h-full items-center justify-center text-slate-500"><Loader2 className="animate-spin" size={20} /></div>}</div>
            <p className="mt-2 truncate text-sm font-medium">{card.name}</p>
            <p className={`mt-1 text-xs ${card.status === "error" ? "text-red-300" : "text-slate-500"}`} role="status">{card.status === "error" ? card.error : card.status === "done" ? `${card.questionCount} question(s) extracted` : `${card.status[0].toUpperCase()}${card.status.slice(1)}...`}</p>
            <div className="mt-3 flex flex-wrap gap-2">{card.status === "error" && card.file ? <button className="button-secondary px-3 py-1.5 text-xs" onClick={() => extractCards([card])} type="button"><RotateCcw size={13} /> Retry</button> : null}<button className="button-secondary px-3 py-1.5 text-xs" onClick={() => addQuestion(card.id)} type="button"><Plus size={13} /> Add question</button><button className="button-secondary px-3 py-1.5 text-xs" disabled={saving} onClick={() => removeCard(card.id)} type="button"><Trash2 size={13} /> Remove image</button></div>
          </> : <><p className="font-medium">Questions without a source image</p><button className="button-secondary mt-3 px-3 py-1.5 text-xs" onClick={() => addQuestion(null)} type="button"><Plus size={13} /> Add question</button></>}
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

    <div className="card space-y-4 p-6">
      <div><h2 className="text-xl font-semibold">Answer key</h2><p className="mt-1 text-sm text-slate-500">Paste pairs such as &quot;1-B, 2-C, 3-A&quot;, or upload an image or PDF of the key. Unmatched and conflicting questions stay blank until you choose.</p></div>
      <textarea className="field min-h-24 font-mono text-sm" placeholder={"1-B, 2-C, 3-A"} value={keyText} onChange={(event) => setKeyText(event.target.value)} />
      <div className="flex flex-wrap gap-3">
        <button className="button-secondary" disabled={!keyText.trim() || !questions.length} onClick={() => applyPairs(parseAnswerKeyText(keyText))} type="button">Apply pasted key</button>
        <input ref={keyFileInput} accept={`${ACCEPT},application/pdf`} className="sr-only" type="file" onChange={(event) => { uploadKeyFile(event.target.files?.[0]); event.target.value = ""; }} />
        <button className="button-secondary" disabled={keyBusy || !questions.length} onClick={() => keyFileInput.current?.click()} type="button">{keyBusy ? <Loader2 className="animate-spin" size={15} /> : <Upload size={15} />} Upload key image or PDF</button>
      </div>
      {keyCounts ? <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">{[["Matched", keyCounts.matched], ["Unmatched", keyCounts.unmatched], ["Conflicting", keyCounts.conflicting], ["Keys with no question", keyCounts.unusedKeys]].map(([label, value]) => <div className="rounded-xl border border-line p-3" key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 text-2xl font-semibold">{value}</dd></div>)}</dl> : null}
    </div>

    <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-400">{questions.length} question(s){blockingCount ? ` · ${blockingCount} need fixing` : ""} · {questions.filter((question) => !question.correctKey).length} without an answer key. Nothing is saved until you click Save set.</p>
      <button className="button-primary" disabled={saving || busy || !questions.length} onClick={saveSet} type="button">{saving ? <Loader2 className="animate-spin" size={16} /> : null} Save set</button>
    </div>
    {message ? <p className="text-sm text-slate-400" role="status">{message}</p> : null}

    <div className="space-y-3">
      <h2 className="text-2xl font-bold">Saved sets</h2>
      {sets.length ? sets.map((set) => <div className="card flex flex-wrap items-center justify-between gap-3 p-4" key={set.id}><div className="min-w-0"><p className="font-semibold">{set.title}</p><p className="mt-1 text-sm text-slate-500">{set.year ? `${set.year} · ` : ""}{set.questionCount ?? set.cbt_questions?.[0]?.count ?? 0} questions · {set.is_published ? "Published" : "Draft"}</p></div><div className="flex gap-2">{set.is_published ? <a className="button-secondary px-3 py-2 text-sm" href={`/cbt/${set.id}`}>Open</a> : null}<button className="button-secondary px-3 py-2 text-sm" onClick={() => togglePublish(set)} type="button">{set.is_published ? "Unpublish" : "Publish"}</button></div></div>) : <div className="card p-6 text-slate-400">No CBT sets saved yet.</div>}
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
  return <article className="rounded-xl border border-line p-4">
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm"><span className="text-slate-400">No.</span><input aria-label="Question number" className="field w-20 py-1.5" min="1" type="number" value={Number.isFinite(question.number) ? question.number : ""} onChange={(event) => onChange({ number: event.target.value === "" ? NaN : Number(event.target.value) })} /></label>
      <div className="flex flex-wrap gap-1.5">{flags.map((flag) => <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${BLOCKING_FLAGS.has(flag) ? "border-red-400/50 text-red-300" : "border-amber-400/50 text-amber-200"}`} key={flag}><AlertTriangle size={11} />{flag}</span>)}</div>
      <div className="ml-auto flex flex-wrap gap-1.5">
        <button className="button-secondary px-2.5 py-1.5 text-xs" disabled={!canMerge} onClick={onMerge} title="Merge with the next question" type="button"><Merge size={13} /> Merge next</button>
        <button className="button-secondary px-2.5 py-1.5 text-xs" onClick={onSplit} title="Split the text at the cursor into a new question" type="button"><Scissors size={13} /> Split</button>
        <button className="button-secondary px-2.5 py-1.5 text-xs text-red-300" onClick={onDelete} type="button"><Trash2 size={13} /> Delete</button>
      </div>
    </div>
    <label className="mt-3 block text-sm"><span className="mb-1 block text-slate-400">Question text</span><textarea className="field min-h-24" value={question.text} onChange={(event) => onChange({ text: event.target.value })} onClick={trackCursor} onKeyUp={trackCursor} onSelect={trackCursor} /></label>
    <details className="mt-2 text-sm" open={Boolean(question.passage)}><summary className="cursor-pointer text-slate-400">Passage (optional)</summary><textarea className="field mt-2 min-h-20" value={question.passage} onChange={(event) => onChange({ passage: event.target.value })} /></details>
    <div className="mt-3 space-y-2">{question.options.map((option, index) => <div className="flex gap-2" key={index}><input aria-label="Option letter" className="field w-14 py-2 text-center uppercase" maxLength={1} value={option.key} onChange={(event) => updateOption(index, { key: event.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} /><input aria-label={`Option ${option.key} text`} className="field py-2" value={option.text} onChange={(event) => updateOption(index, { text: event.target.value })} /><button aria-label={`Remove option ${option.key}`} className="rounded-lg px-2 text-slate-500 hover:text-red-300" onClick={() => onChange({ options: question.options.filter((_, optionIndex) => optionIndex !== index) })} type="button"><Trash2 size={14} /></button></div>)}<button className="text-xs text-electric" onClick={addOption} type="button">+ Add option</button></div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="block text-sm"><span className="mb-1 block text-slate-400">Correct option{question.keyStatus === "conflicting" ? ` (key says ${question.keyCandidates?.join(" / ")})` : question.keyStatus === "unmatched" ? " (not in key)" : ""}</span><select className="field" value={question.correctKey} onChange={(event) => onChange({ correctKey: event.target.value, keyStatus: event.target.value ? "chosen" : question.keyStatus })}><option value="">Not set</option>{question.options.filter((option) => option.key).map((option) => <option key={option.key} value={option.key}>{option.key}</option>)}</select></label>
      <label className="block text-sm"><span className="mb-1 block text-slate-400">Explanation (optional)</span><input className="field" value={question.explanation} onChange={(event) => onChange({ explanation: event.target.value })} /></label>
    </div>
    <div className="mt-3 flex flex-wrap gap-4 text-sm">
      <label className="flex items-center gap-2"><input checked={question.hasFigure} className="h-4 w-4" type="checkbox" onChange={(event) => onChange({ hasFigure: event.target.checked, attachSource: event.target.checked || question.attachSource })} />Has figure</label>
      <label className={`flex items-center gap-2 ${question.sourceIds.length ? "" : "opacity-50"}`}><input checked={question.attachSource} className="h-4 w-4" disabled={!question.sourceIds.length} type="checkbox" onChange={(event) => onChange({ attachSource: event.target.checked })} />Show source image to students</label>
    </div>
  </article>;
}
