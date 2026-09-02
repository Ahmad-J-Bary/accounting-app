export interface UpdateInfo {
  has_update: boolean;
  current_version: string;
  latest_version: string;
  release_name: string;
  release_body: string;
  release_url: string;
  download_url: string | null;
}

const OWNER = "Ahmad-J-Bary";
const REPO = "accounting-app";

function parseSemver(version: string): [number, number, number] {
  const v = version.replace(/^v/, "");
  const parts = v.split(".");
  return [
    parseInt(parts[0]) || 0,
    parseInt(parts[1]) || 0,
    parseInt(parts[2]) || 0,
  ];
}

function ensureVPrefix(version: string): string {
  return version.startsWith("v") ? version : `v${version}`;
}

function compareVersions(current: string, latest: string): boolean {
  const [cmaj, cmin, cpat] = parseSemver(current);
  const [lmaj, lmin, lpat] = parseSemver(latest);
  if (lmaj !== cmaj) return lmaj > cmaj;
  if (lmin !== cmin) return lmin > cmin;
  return lpat > cpat;
}

export const updateService = {
  async checkForUpdates(currentVersion: string): Promise<UpdateInfo> {
    // Primary source: raw.githubusercontent.com (no rate limits) — avoids the
    // unauthenticated `api.github.com` 403 (60 req/hr per IP) that otherwise
    // floods the console with network errors. The version lives in package.json.
    const versionUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/apps/desktop/package.json`;

    try {
      const versionRes = await fetch(versionUrl);
      if (!versionRes.ok) {
        throw new Error(`فشل التحقق من إصدار التطبيق (${versionRes.status})`);
      }

      const pkgJson = await versionRes.json();
      const latestVersion = pkgJson.version;
      const hasUpdate = compareVersions(currentVersion, latestVersion);

      const ua = navigator.userAgent.toLowerCase();
      const isWindows = ua.includes("win");
      const isMac = ua.includes("mac");

      // Construct standard release asset download URL
      const tag = ensureVPrefix(latestVersion);
      let downloadUrl = "";
      if (isWindows) {
        // e.g. Almowakeb_0.9.2_x64-setup.exe
        downloadUrl = `https://github.com/${OWNER}/${REPO}/releases/download/${tag}/Almowakeb_${pkgJson.version}_x64-setup.exe`;
      } else if (isMac) {
        downloadUrl = `https://github.com/${OWNER}/${REPO}/releases/download/${tag}/Almowakeb_${pkgJson.version}_universal.dmg`;
      } else {
        downloadUrl = `https://github.com/${OWNER}/${REPO}/releases/download/${tag}/Almowakeb_${pkgJson.version}_universal.AppImage`;
      }

      return {
        has_update: hasUpdate,
        current_version: currentVersion,
        latest_version: latestVersion,
        release_name: `الإصدار ${latestVersion}`,
        release_body: hasUpdate
          ? "يتوفر تحديث جديد للتطبيق. يمكنك تنزيل التحديث الآن أو الاطلاع على التفاصيل على موقع GitHub."
          : "التطبيق محدّث بالفعل.",
        release_url: `https://github.com/${OWNER}/${REPO}/releases/tag/${tag}`,
        download_url: downloadUrl,
      };
    } catch (e) {
      throw new Error(`فشل التحقق من التحديثات: ${e}`);
    }
  },
};
