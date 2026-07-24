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

function compareVersions(current: string, latest: string): boolean {
  const [cmaj, cmin, cpat] = parseSemver(current);
  const [lmaj, lmin, lpat] = parseSemver(latest);
  if (lmaj !== cmaj) return lmaj > cmaj;
  if (lmin !== cmin) return lmin > cmin;
  return lpat > cpat;
}

export const updateService = {
  async checkForUpdates(currentVersion: string): Promise<UpdateInfo> {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;

    // Attempt with Token if available in environment (useful for developers/CI)
    const token = typeof process !== 'undefined' && process.env ? process.env.GITHUB_TOKEN : undefined;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };
    if (token) {
      headers["Authorization"] = `token ${token}`;
    }

    try {
      const res = await fetch(url, { headers });

      if (!res.ok) {
        throw new Error(`GitHub API returned ${res.status}`);
      }

      const release = await res.json();
      const latestVersion = release.tag_name.replace(/^v/, "");
      const hasUpdate = compareVersions(currentVersion, latestVersion);

      const ua = navigator.userAgent.toLowerCase();
      const isWindows = ua.includes("win");
      const isMac = ua.includes("mac");

      const asset = (release.assets || []).find((a: { name: string; browser_download_url: string }) => {
        if (isWindows) {
          return a.name.endsWith(".exe") || a.name.endsWith(".msi");
        } else if (isMac) {
          return a.name.endsWith(".dmg");
        } else {
          return a.name.endsWith(".AppImage") || a.name.endsWith(".deb") || a.name.endsWith(".rpm");
        }
      });

      return {
        has_update: hasUpdate,
        current_version: currentVersion,
        latest_version: latestVersion,
        release_name: release.name || latestVersion,
        release_body: release.body || "",
        release_url: release.html_url,
        download_url: asset?.browser_download_url ?? null,
      };
    } catch (e) {
      console.warn("GitHub API rate limited or failed, executing fallback check:", e);

      // Fallback: Fetch package.json from raw.githubusercontent.com (No Rate Limits)
      const fallbackUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/apps/desktop/package.json`;
      const fallbackRes = await fetch(fallbackUrl);
      if (!fallbackRes.ok) {
        throw new Error(`فشل التحقق من التحديثات: تم تجاوز حد طلبات GitHub وفشل الاتصال الاحتياطي (${fallbackRes.status})`);
      }

      const pkgJson = await fallbackRes.json();
      const latestVersion = pkgJson.version;
      const hasUpdate = compareVersions(currentVersion, latestVersion);

      const ua = navigator.userAgent.toLowerCase();
      const isWindows = ua.includes("win");
      const isMac = ua.includes("mac");

      // Construct standard release asset download URL
      let downloadUrl = "";
      if (isWindows) {
        // e.g. Almowakeb_0.9.2_x64-setup.exe
        downloadUrl = `https://github.com/${OWNER}/${REPO}/releases/download/${latestVersion}/Almowakeb_${pkgJson.version}_x64-setup.exe`;
      } else if (isMac) {
        downloadUrl = `https://github.com/${OWNER}/${REPO}/releases/download/${latestVersion}/Almowakeb_${pkgJson.version}_universal.dmg`;
      } else {
        downloadUrl = `https://github.com/${OWNER}/${REPO}/releases/download/${latestVersion}/Almowakeb_${pkgJson.version}_universal.AppImage`;
      }

      return {
        has_update: hasUpdate,
        current_version: currentVersion,
        latest_version: latestVersion,
        release_name: `الإصدار ${latestVersion}`,
        release_body: "يتوفر تحديث جديد للتطبيق. تم استخدام الفحص الاحتياطي نظراً لقيود شبكة GitHub API. يمكنك تنزيل التحديث الآن أو الاطلاع على التفاصيل على موقع GitHub.",
        release_url: `https://github.com/${OWNER}/${REPO}/releases/tag/${latestVersion}`,
        download_url: downloadUrl,
      };
    }
  },
};
