using System.Text.RegularExpressions;
using VersOne.Epub;

namespace server.Services;

public class EpubChapterParser
{
    public List<ChapterPreview> Preview(Stream epubStream)
    {
        var chapters = Parse(epubStream);
        return chapters.Select((c, i) => new ChapterPreview(
            i,
            c.Title,
            c.Text.Length > 200 ? c.Text[..200] + "..." : c.Text
        )).ToList();
    }

    public List<Chapter> Parse(Stream epubStream)
    {
        var book = EpubReader.ReadBook(epubStream);
        var chapters = new List<Chapter>();
        int num = 1;

        foreach (var item in book.ReadingOrder)
        {
            var title = FindTitle(item, book, num);
            var text = ExtractText(item.Content);

            if (string.IsNullOrWhiteSpace(text) ||
                text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length < 50)
                continue;

            chapters.Add(new Chapter(title, text.Trim(), num++));
        }

        if (chapters.Count == 0)
        {
            var allText = string.Join(" ", book.ReadingOrder.Select(i => ExtractText(i.Content)));
            return SplitByWordCount(allText);
        }

        return chapters;
    }

    private static string FindTitle(EpubLocalTextContentFile item, EpubBook book, int fallbackNum)
    {
        // Check navigation/TOC for a matching entry
        if (book.Navigation != null)
        {
            var match = FindNavTitle(book.Navigation, item.FilePath);
            if (match != null) return match;
        }

        // Extract from HTML heading or <title>
        var h = Regex.Match(item.Content ?? "", @"<(?:h1|h2|title)[^>]*>\s*([^<]+)", RegexOptions.IgnoreCase);
        if (h.Success)
        {
            var t = System.Net.WebUtility.HtmlDecode(h.Groups[1].Value.Trim());
            if (!string.IsNullOrWhiteSpace(t) && t.Length < 120) return t;
        }

        return $"Chapter {fallbackNum}";
    }

    private static string? FindNavTitle(IEnumerable<EpubNavigationItem> items, string fileName)
    {
        foreach (var item in items)
        {
            if (item.Link?.ContentFilePath != null &&
                string.Equals(item.Link.ContentFilePath, fileName, StringComparison.OrdinalIgnoreCase))
                return item.Title;

            if (item.NestedItems?.Count > 0)
            {
                var found = FindNavTitle(item.NestedItems, fileName);
                if (found != null) return found;
            }
        }
        return null;
    }

    private static string ExtractText(string? html)
    {
        if (string.IsNullOrEmpty(html)) return "";
        html = Regex.Replace(html, @"<(script|style)[^>]*>[\s\S]*?</\1>", "", RegexOptions.IgnoreCase);
        html = Regex.Replace(html, @"<[^>]+>", " ");
        html = System.Net.WebUtility.HtmlDecode(html);
        html = Regex.Replace(html, @"\s+", " ").Trim();
        return html;
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
