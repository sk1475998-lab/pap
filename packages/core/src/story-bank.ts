import { QuestionCategory } from "./question-classifier.js";

export interface STARStory {
  id: string;
  category: QuestionCategory;
  title: string;           // e.g. "React Migration at Company X"
  situation: string;
  task: string;
  action: string;
  result: string;
  keywords: string[];      // skills/keywords this story maps to
  lastUsed?: Date;
}

export class StoryBank {
  private stories: STARStory[];

  constructor(stories: STARStory[]) {
    this.stories = stories;
  }

  /**
   * Find the best matching story for a category and job context keywords.
   */
  selectStory(category: QuestionCategory, jobKeywords: string[] = []): STARStory | null {
    const matching = this.stories.filter((s) => s.category === category);
    if (matching.length === 0) return null;

    // Score stories by keyword intersection
    const scored = matching.map((story) => {
      const matchCount = story.keywords.filter((key) =>
        jobKeywords.some((jk) => jk.toLowerCase().includes(key.toLowerCase()))
      ).length;
      return { story, score: matchCount };
    });

    // Sort by descending score, and then by least recently used to reduce repeating
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aTime = a.story.lastUsed?.getTime() ?? 0;
      const bTime = b.story.lastUsed?.getTime() ?? 0;
      return aTime - bTime;
    });

    const best = scored[0]?.story ?? null;
    if (best) {
      best.lastUsed = new Date();
    }
    return best;
  }

  /**
   * Compose a concise response from a STAR story under the requested word limit.
   */
  composeResponse(story: STARStory, wordLimit = 150): string {
    const full = `${story.situation} ${story.task} ${story.action} ${story.result}`.trim();
    const words = full.split(/\s+/);
    if (words.length <= wordLimit) return full;
    return words.slice(0, wordLimit).join(" ") + "...";
  }
}
