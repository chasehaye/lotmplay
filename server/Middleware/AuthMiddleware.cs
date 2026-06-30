namespace server.Middleware;

public class AuthMiddleware(RequestDelegate next, IConfiguration config)
{
    public async Task Invoke(HttpContext ctx)
    {
        var path = ctx.Request.Path.Value ?? "";

        // Allow login endpoint and static files through without auth
        if (path.StartsWith("/api/auth") || path.StartsWith("/files"))
        {
            await next(ctx);
            return;
        }

        // Only protect /api routes
        if (path.StartsWith("/api"))
        {
            var expectedToken = config["Auth:Token"];
            var auth = ctx.Request.Headers.Authorization.ToString();
            var token = auth.StartsWith("Bearer ") ? auth["Bearer ".Length..] : null;

            if (token != expectedToken)
            {
                ctx.Response.StatusCode = 401;
                await ctx.Response.WriteAsJsonAsync(new { message = "Unauthorized" });
                return;
            }
        }

        await next(ctx);
    }
}
