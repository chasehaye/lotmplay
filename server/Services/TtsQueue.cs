using System.Collections.Concurrent;

namespace server.Services;

public record TtsWorkItem(int JobId);

public class TtsQueue
{
    private readonly ConcurrentQueue<TtsWorkItem> _queue = new();
    private readonly SemaphoreSlim _signal = new(0);

    public void Enqueue(TtsWorkItem item)
    {
        _queue.Enqueue(item);
        _signal.Release();
    }

    public async Task<TtsWorkItem> DequeueAsync(CancellationToken ct)
    {
        await _signal.WaitAsync(ct);
        _queue.TryDequeue(out var item);
        return item!;
    }
}
