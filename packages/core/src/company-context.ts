export interface CompanyContext {
  companyId: string;
  name: string;
  industry: string;
  techStack?: string[];
  missionStatement?: string;
  rating?: number;
  medianSalaryLPA?: number;
  cachedAt: Date;
}

export class CompanyContextService {
  private cache = new Map<string, CompanyContext>();
  private cacheTTLMs = 14 * 24 * 60 * 60 * 1000; // 14 days

  /**
   * Returns details for a target company, prioritizing the local memory cache.
   */
  async getContext(companyName: string): Promise<CompanyContext> {
    const slug = this.slugify(companyName);
    const cached = this.cache.get(slug);

    if (cached && Date.now() - cached.cachedAt.getTime() < this.cacheTTLMs) {
      return cached;
    }

    const fetched = await this.scrapeCompanyContext(companyName);
    this.cache.set(slug, fetched);
    return fetched;
  }

  private slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  }

  private async scrapeCompanyContext(name: string): Promise<CompanyContext> {
    // No company data source is configured. Do not represent generic defaults
    // as research about a specific employer.
    return {
      companyId: this.slugify(name),
      name,
      industry: "Unknown",
      cachedAt: new Date(),
    };
  }
}
