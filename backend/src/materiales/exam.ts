import { randomInt } from "node:crypto";
import { HttpError } from "../errors.js";

const segmenter = new Intl.Segmenter("es", { granularity: "sentence" });
const ignored = new Set(
  "además algunas algunos aquellos cuando deben desde donde durante estas estos existe hacer hasta mismo muchas muchos nuestra nuestro otras otros parece partir permite pueden serían sobre también tienen todas todos través varias varios".split(
    " ",
  ),
);
const normalize = (word: string) => word.toLocaleLowerCase("es");
const words = (text: string) =>
  [...text.matchAll(/\p{L}{5,}/gu)].filter(
    (match) => !ignored.has(normalize(match[0])),
  );

function shuffle<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

export function createExam(text: string) {
  const sentences = Array.from(segmenter.segment(text), ({ segment }) =>
    segment.trim().replace(/\s+/g, " "),
  ).filter(
    (sentence) => sentence.length <= 420 && sentence.split(" ").length >= 7,
  );
  const vocabulary = [...new Set(words(text).map(([word]) => normalize(word)))];
  const used = new Set<string>();
  const questions = [];

  for (const sentence of shuffle(sentences)) {
    const present = new Set(words(sentence).map(([word]) => normalize(word)));
    for (const match of words(sentence).sort(
      (a, b) => b[0].length - a[0].length,
    )) {
      const answer = normalize(match[0]);
      if (used.has(answer)) continue;
      const distractors = shuffle(
        vocabulary.filter((word) => !present.has(word)),
      )
        .sort(
          (a, b) =>
            Math.abs(a.length - answer.length) -
            Math.abs(b.length - answer.length),
        )
        .slice(0, 3);
      if (distractors.length < 3) continue;
      const options = shuffle([answer, ...distractors]);
      questions.push({
        enunciado:
          sentence.slice(0, match.index) +
          "____" +
          sentence.slice(match.index + match[0].length),
        opciones: options,
        correcta: options.indexOf(answer),
        explicacion: sentence,
      });
      used.add(answer);
      break;
    }
    if (questions.length === 5) break;
  }
  if (!questions.length) {
    throw new HttpError(
      422,
      "Este material tiene poco texto para armar opciones. Elegí un apunte más completo.",
    );
  }
  return questions;
}
