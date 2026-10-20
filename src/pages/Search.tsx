import { Link, useSearchParams } from "react-router-dom";
import { PageHeading, Loading, Empty, SearchInput } from "../components/UI";
import { useData } from "../hooks/useData";
export function SearchPage() {
  const data = useData();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  if (!data) return <Loading />;
  const matches = (text: string) =>
    query.trim() && text.toLowerCase().includes(query.toLowerCase());
  const groups = [
    {
      title: "Слова",
      items: data.words
        .filter((w) =>
          matches(`${w.term} ${w.translation} ${w.tags.join(" ")}`),
        )
        .map((w) => ({
          id: w.id,
          title: w.term,
          subtitle: w.translation,
          path: `/vocabulary?word=${w.id}`,
        })),
    },
    {
      title: "Колоды",
      items: data.decks
        .filter((d) => matches(`${d.title} ${d.tags.join(" ")}`))
        .map((d) => ({
          id: d.id,
          title: d.title,
          subtitle: d.description,
          path: `/decks/${d.id}`,
        })),
    },
    {
      title: "Тексты",
      items: data.texts
        .filter((t) => matches(`${t.title} ${t.content} ${t.tags.join(" ")}`))
        .map((t) => ({
          id: t.id,
          title: t.title,
          subtitle: t.source,
          path: `/reader/${t.id}`,
        })),
    },
    {
      title: "Видео",
      items: data.videos
        .filter((v) =>
          matches(
            `${v.title} ${v.tags.join(" ")} ${v.subtitles.map((s) => s.text).join(" ")}`,
          ),
        )
        .map((v) => ({
          id: v.id,
          title: v.title,
          subtitle: "YouTube",
          path: `/videos/${v.id}`,
        })),
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="ВСЁ ПОД РУКОЙ"
        title="Поиск в вашем пространстве"
        description="Слова, тексты, колоды, видео и теги — по всем языкам."
      />
      <SearchInput
        value={query}
        onChange={(q) => setParams({ q }, { replace: true })}
        placeholder="Что вы ищете?"
      />
      <div className="search-results">
        {groups
          .filter((g) => g.items.length)
          .map((group) => (
            <section className="panel" key={group.title}>
              <h2>
                {group.title}{" "}
                <span className="badge">{group.items.length}</span>
              </h2>
              {group.items.slice(0, 50).map((item) => (
                <Link className="continue-row" to={item.path} key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </div>
                  <span>↗</span>
                </Link>
              ))}
            </section>
          ))}
      </div>
      {!groups.some((g) => g.items.length) && (
        <Empty
          title={query ? "Ничего не найдено" : "Начните со слова или темы"}
          description="Поиск работает по всему содержимому вашей библиотеки."
        />
      )}
    </>
  );
}
