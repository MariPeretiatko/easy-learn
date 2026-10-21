import { AutoTextarea } from "../components/AutoTextarea";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, BookOpenCheck, ArrowLeft } from "lucide-react";
import { useData } from "../hooks/useData";
import { SolutionRepository } from "../services/solutions";
import { uid } from "../utils/format";
import { Empty, Loading, Modal, Confirm } from "../components/UI";
import { perform } from "../store/useUI";
import type { Solution } from "../types";
export function SolutionsPage() {
  const data = useData(["solutions"]);
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Solution | null>(null);
  const [remove, setRemove] = useState(false);
  if (!data) return <Loading />;
  const selected = data.solutions.find((s) => s.id === id);
  const blank = (): Solution => ({
    id: uid(),
    title: "",
    question: "",
    answer: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const value = editing ?? (params.get("new") ? blank() : null);
  return (
    <div className="quizlet-solutions">
      <div className="clone-page-heading">
        <div>
          <h1>{selected?.title ?? "Решения"}</h1>
          <p>Ваши вопросы, подробные разборы и объяснения.</p>
        </div>
        <div className="inline-actions">
          {selected ? (
            <>
              <button
                className="button secondary"
                onClick={() => setEditing(selected)}
              >
                <Pencil size={17} />
                Редактировать
              </button>
              <button
                className="icon-button"
                aria-label="Удалить решение"
                onClick={() => setRemove(true)}
              >
                <Trash2 size={18} />
              </button>
            </>
          ) : (
            <button className="button" onClick={() => setEditing(blank())}>
              <Plus size={18} />
              Добавить решение
            </button>
          )}
        </div>
      </div>
      {selected ? (
        <>
          <Link className="back-link" to="/solutions">
            <ArrowLeft size={16} />
            Все решения
          </Link>
          <section className="solution-sheet">
            <h2>Условие</h2>
            <p>{selected.question}</p>
            <hr />
            <h2>
              <BookOpenCheck size={23} />
              Решение
            </h2>
            <p>{selected.answer}</p>
          </section>
        </>
      ) : (
        <div className="solution-library">
          {data.solutions.map((s) => (
            <Link
              className="quizlet-set-row"
              key={s.id}
              to={`/solutions/${s.id}`}
            >
              <span className="set-row-meta">
                {new Date(s.updatedAt).toLocaleDateString("ru-RU")}
              </span>
              <strong>{s.title}</strong>
            </Link>
          ))}
          {!data.solutions.length && (
            <Empty
              title="Сохраните первое решение"
              description="Добавьте условие задачи и пошаговое объяснение."
              action={
                <button className="button" onClick={() => setEditing(blank())}>
                  Добавить решение
                </button>
              }
            />
          )}
        </div>
      )}
      {value && (
        <SolutionEditor
          key={value.id}
          solution={value}
          onClose={() => {
            setEditing(null);
            setParams({});
          }}
        />
      )}
      {remove && selected && (
        <Confirm
          title="Удалить решение?"
          description="Сохранённый разбор будет удалён."
          onClose={() => setRemove(false)}
          onConfirm={() =>
            void perform(async () => {
              await SolutionRepository.delete(selected.id);
              window.location.assign("/solutions");
            })
          }
        />
      )}
    </div>
  );
}
function SolutionEditor({
  solution,
  onClose,
}: {
  solution: Solution;
  onClose: () => void;
}) {
  const [value, setValue] = useState(solution);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal wide title="Сохранить решение" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void SolutionRepository.save(value)
            .then(onClose)
            .catch(() => setError("Не удалось сохранить решение"))
            .finally(() => setBusy(false));
        }}
      >
        <label>
          Название
          <input
            required
            value={value.title}
            onChange={(e) => setValue({ ...value, title: e.target.value })}
          />
        </label>
        <label>
          Условие задачи
          <AutoTextarea
            required
            rows={4}
            value={value.question}
            onChange={(e) => setValue({ ...value, question: e.target.value })}
          />
        </label>
        <label>
          Решение и объяснение
          <AutoTextarea
            required
            rows={7}
            value={value.answer}
            onChange={(e) => setValue({ ...value, answer: e.target.value })}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="button" disabled={busy}>
            Сохранить решение
          </button>
        </div>
      </form>
    </Modal>
  );
}
