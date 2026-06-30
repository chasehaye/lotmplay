using System.Text;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace server.Services;

public record Chapter(string Title, string Text, int Number);
public record ChapterPreview(int Index, string Title, string Snippet);

public class PdfChapterParser
{
    public List<ChapterPreview> Preview(Stream pdfStream)
    {
        var chapters = Parse(pdfStream);
        return chapters.Select((c, i) => new ChapterPreview(
            i,
            c.Title,
            c.Text.Length > 200 ? c.Text[..200] + "..." : c.Text
        )).ToList();
    }

    public List<Chapter> Parse(Stream pdfStream)
    {
        using var doc = PdfDocument.Open(pdfStream);

        var allWords = new List<(string Text, double FontSize, int Page)>();

        foreach (var page in doc.GetPages())
        {
            foreach (var word in page.GetWords())
            {
                var fontSize = word.Letters.Count > 0 ? word.Letters[0].FontSize : 0;
                allWords.Add((word.Text, Math.Abs(fontSize), page.Number));
            }
        }

        if (allWords.Count == 0) return [];

        // Determine body font size as the most common font size
        var bodyFontSize = allWords
            .Where(w => w.FontSize > 0)
            .GroupBy(w => Math.Round(w.FontSize, 1))
            .OrderByDescending(g => g.Count())
            .First().Key;

        // Heading threshold: significantly larger than body text
        var headingThreshold = bodyFontSize * 1.2;

        // Reconstruct lines grouped by page, preserving font size per line
        var lines = GroupIntoLines(allWords, bodyFontSize, headingThreshold);

        return SplitIntoChapters(lines);
    }

    private record Line(string Text, bool IsHeading);

    private static List<Line> GroupIntoLines(
        List<(string Text, double FontSize, int Page)> words,
        double bodySize,
        double headingThreshold)
    {
        var lines = new List<Line>();
        var currentWords = new List<string>();
        bool currentIsHeading = false;
        int currentPage = -1;

        foreach (var (text, fontSize, page) in words)
        {
            bool isLarge = fontSize >= headingThreshold;

            // New page or font size category change = new line
            if (page != currentPage || isLarge != currentIsHeading)
            {
                if (currentWords.Count > 0)
                    lines.Add(new Line(string.Join(" ", currentWords), currentIsHeading));

                currentWords.Clear();
                currentIsHeading = isLarge;
                currentPage = page;
            }

            currentWords.Add(text);
        }

        if (currentWords.Count > 0)
            lines.Add(new Line(string.Join(" ", currentWords), currentIsHeading));

        return lines;
    }

    private static List<Chapter> SplitIntoChapters(List<Line> lines)
    {
        var chapters = new List<Chapter>();
        string? currentTitle = null;
        var currentText = new StringBuilder();
        int chapterNum = 1;

        foreach (var line in lines)
        {
            if (line.IsHeading && line.Text.Trim().Length > 0)
            {
                // Save previous chapter if it has content
                if (currentTitle != null && currentText.Length > 100)
                {
                    chapters.Add(new Chapter(currentTitle, currentText.ToString().Trim(), chapterNum++));
                    currentText.Clear();
                }
                currentTitle = line.Text.Trim();
            }
            else
            {
                currentText.Append(line.Text).Append(' ');
            }
        }

        // Save last chapter
        if (currentTitle != null && currentText.Length > 0)
            chapters.Add(new Chapter(currentTitle, currentText.ToString().Trim(), chapterNum));

        // Fallback: no headings detected, split by word count
        if (chapters.Count == 0)
        {
            var allText = string.Join(" ", lines.Select(l => l.Text));
            return SplitByWordCount(allText);
        }

        return chapters;
    }

    private static List<Chapter> SplitByWordCount(string fullText, int wordsPerChapter = 3000)
    {
        var words = fullText.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var chapters = new List<Chapter>();
        int num = 1;
        for (int i = 0; i < words.Length; i += wordsPerChapter)
        {
            var chunk = string.Join(' ', words.Skip(i).Take(wordsPerChapter));
            chapters.Add(new Chapter($"Chapter {num}", chunk, num));
            num++;
        }
        return chapters;
    }
}
