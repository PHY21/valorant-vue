export function safeReturnPath(value) {
  if (typeof value !== "string" || /[\\\u0000-\u001f]/.test(value))
    return "/account";
  const [path] = value.split("?");
  return /^(\/|\/account|\/admin|\/inbox|\/favorites|\/compare(?:\/teams)?|\/rankings|\/about|\/explore\/(player|team|tournament|agent)|\/detail\/(player|team|tournament|agent)\/[1-9]\d*)$/.test(
    path,
  )
    ? value
    : "/account";
}

export function normalizeEmail(value = "") {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.endsWith(".invalid")
  )
    throw new Error("请输入可以收信的有效邮箱地址。");
  return email;
}

export function hasVerifiedEmail(user) {
  if (!user?.email_confirmed_at || user.is_anonymous) return false;
  try {
    normalizeEmail(user.email);
    return true;
  } catch {
    return false;
  }
}

export function validatePassword(password = "", confirm = "") {
  if (password.length < 8 || password.length > 128)
    return "密码需要 8–128 个字符。";
  if (password !== confirm) return "两次输入的密码不一致。";
  return "";
}

export function validateRegistration({
  email = "",
  password = "",
  confirm = "",
  name = "",
}) {
  try {
    normalizeEmail(email);
  } catch (error) {
    return error.message;
  }
  if (!name.trim() || name.trim().length > 24) return "昵称需要 1–24 个字符。";
  return validatePassword(password, confirm);
}

export function publicAuthConfig(url, key) {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      !/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)
    )
      return null;
    return { url: parsed.origin, key };
  } catch {
    return null;
  }
}

export function authMessage(error) {
  const messages = {
    invalid_credentials: "邮箱或密码不正确，请重新输入。",
    email_not_confirmed: "请先验证邮箱，再登录网站。",
    user_already_exists: "无法创建账号，请尝试登录或找回密码。",
    email_exists: "无法创建账号，请尝试登录或找回密码。",
    otp_expired: "验证码不正确或已过期，请重新获取。",
    validation_failed: "输入信息不正确，请检查邮箱和验证码。",
    same_password: "新密码不能与原密码相同。",
    weak_password: "密码强度不足，请增加长度并混合使用字母、数字和符号。",
    signup_disabled: "暂时未开放注册，请稍后再试。",
    over_request_rate_limit: "操作过于频繁，请稍后再试。",
    over_email_send_rate_limit: "邮件发送过于频繁，请稍后再试。",
    email_address_not_authorized: "邮件服务尚未准备好，请稍后再试。",
  };
  return messages[error?.code] || "暂时无法连接账号服务，请检查网络后重试。";
}

export function createAccountService(client) {
  function requireClient() {
    if (!client) throw new Error("账号服务尚未配置，暂时无法登录或注册。");
    return client.auth;
  }
  async function result(promise) {
    try {
      const { data, error } = await promise;
      if (error) throw new Error(authMessage(error));
      return data;
    } catch (error) {
      if (error instanceof Error && error.message.includes("。")) throw error;
      throw new Error(authMessage(error));
    }
  }
  return {
    async register(fields) {
      const invalid = validateRegistration(fields);
      if (invalid) throw new Error(invalid);
      const data = await result(
        requireClient().signUp({
          email: normalizeEmail(fields.email),
          password: fields.password,
          options: {
            data: {
              display_name: fields.name.trim(),
            },
          },
        }),
      );
      return data;
    },
    async login(email, password) {
      return result(
        requireClient().signInWithPassword({
          email: normalizeEmail(email),
          password,
        }),
      );
    },
    async requestReset(email) {
      return result(
        requireClient().resetPasswordForEmail(normalizeEmail(email)),
      );
    },
    async resendVerification(email) {
      return result(
        requireClient().resend({
          type: "signup",
          email: normalizeEmail(email),
        }),
      );
    },
    async verifyEmail(email, token, type = "email") {
      if (!/^\d{6,10}$/.test(token))
        throw new Error("请输入邮件中的完整数字验证码。");
      if (!["email", "recovery"].includes(type))
        throw new Error("验证方式无效。");
      return result(
        requireClient().verifyOtp({
          email: normalizeEmail(email),
          token,
          type,
        }),
      );
    },
    async updatePassword(password, confirm) {
      const invalid = validatePassword(password, confirm);
      if (invalid) throw new Error(invalid);
      return result(requireClient().updateUser({ password }));
    },
    async logout() {
      return result(requireClient().signOut({ scope: "local" }));
    },
  };
}
