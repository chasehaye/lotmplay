using Microsoft.AspNetCore.Mvc;

namespace server.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IConfiguration config) : ControllerBase
{
    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginDto dto)
    {
        var password = config["Auth:Password"];
        if (dto.Password != password)
            return Unauthorized(new { message = "Incorrect password." });

        var token = config["Auth:Token"];
        return Ok(new { token });
    }
}

public record LoginDto(string Password);
