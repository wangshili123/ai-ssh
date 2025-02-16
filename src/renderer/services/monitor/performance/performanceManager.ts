import { SSHService } from '../../../types';
import { MonitorData, PerformanceData, PerformanceDetailData } from '../../../types/monitor';
import { CpuMetricsService } from './cpuService';
import { MemoryMetricsService } from './memoryService';
import { DiskMetricsService } from './diskService';
import { DiskHealthService } from './diskHealthService';
import { DiskSpaceService } from './diskSpaceService';
import { DiskIoService } from './diskIoService';

/**
 * 性能监控管理器
 * 用于统一管理所有性能监控相关服务
 */
export class PerformanceManager {
    private static instance: PerformanceManager;
    private activeTab: string = '';
    private activeCard: string = '';
    
    // 性能监控相关服务
    private cpuMetricsService: CpuMetricsService;
    private memoryMetricsService: MemoryMetricsService;
    private diskMetricsService: DiskMetricsService;
    private diskHealthService: DiskHealthService;
    private diskSpaceService: DiskSpaceService;
    private diskIoService: DiskIoService;

    // 保存上一次的完整数据
    private lastPerformanceData: Map<string, {
        data: PerformanceData;
        timestamp: number;
    }> = new Map();

    // 记录每个卡片最后更新时间
    private lastDetailUpdate: Map<string, {
        [key in 'cpu' | 'memory' | 'disk' | 'network']?: number;
    }> = new Map();

    // 非活动卡片更新间隔（1分钟）
    private readonly INACTIVE_UPDATE_INTERVAL = 60000;
    
    private constructor(sshService: SSHService) {
        // 初始化所有性能监控服务
        this.cpuMetricsService = CpuMetricsService.getInstance(sshService);
        this.memoryMetricsService = MemoryMetricsService.getInstance(sshService);
        this.diskMetricsService = DiskMetricsService.getInstance(sshService);
        this.diskHealthService = DiskHealthService.getInstance(sshService);
        this.diskSpaceService = DiskSpaceService.getInstance(sshService);
        this.diskIoService = DiskIoService.getInstance(sshService);
    }

    /**
     * 获取单例实例
     */
    static getInstance(sshService: SSHService): PerformanceManager {
        if (!PerformanceManager.instance) {
            PerformanceManager.instance = new PerformanceManager(sshService);
        }
        return PerformanceManager.instance;
    }

    /**
     * 获取卡片详细指标数据
     */
    private async collectCardDetailMetrics(
        sessionId: string,
        card: 'cpu' | 'memory' | 'disk' | 'network',
        activeDetailTab?: string
    ): Promise<any> {  // TODO: 后续可以定义更具体的联合类型
        switch (card) {
            case 'cpu':
                return this.cpuMetricsService.collectDetailMetrics(sessionId, activeDetailTab);
            case 'memory':
                return this.memoryMetricsService.collectDetailMetrics(sessionId);
            case 'disk':
                const [diskDetail, diskHealth, diskSpace, diskIo] = await Promise.all([
                    this.diskMetricsService.collectDetailMetrics(sessionId),
                    this.diskHealthService.getDiskHealth(sessionId),
                    this.diskSpaceService.getSpaceAnalysis(sessionId),
                    this.diskIoService.getIoAnalysis(sessionId)
                ]);
                return {
                    ...diskDetail,
                    health: diskHealth,
                    spaceAnalysis: diskSpace,
                    ioAnalysis: diskIo
                };
            case 'network':
                // TODO: 实现网络详细指标采集
                return null;
        }
    }

    /**
     * 采集性能指标数据
     * @param sessionId 会话ID
     * @param activeCard 当前激活的卡片类型
     * @param activeDetailTab 当前激活的详情标签页
     */
    async collectMetrics(
        sessionId: string,
        activeCard?: 'cpu' | 'memory' | 'disk' | 'network',
        activeDetailTab?: string
    ): Promise<PerformanceData> {
        try {
            console.log('开始采集性能指标数据:', {
                sessionId,
                activeCard,
                activeDetailTab,
                timestamp: new Date().toISOString()
            });

            const startTime = Date.now();
            const lastData = this.lastPerformanceData.get(sessionId)?.data;

            // 获取基础指标（始终需要）
            const [cpuBasic, memoryBasic, diskBasic, networkBasic] = await Promise.all([
                this.cpuMetricsService.collectBasicMetrics(sessionId),
                this.memoryMetricsService.collectBasicMetrics(sessionId),
                this.diskMetricsService.collectBasicMetrics(sessionId),
                // TODO: 实现网络基础指标采集
                Promise.resolve({
                    totalRx: 0,
                    totalTx: 0,
                    rxSpeed: 0,
                    txSpeed: 0
                })
            ]);

            // 构建基础性能数据
            const performanceData: PerformanceData = {
                basic: {
                    cpu: cpuBasic,
                    memory: memoryBasic,
                    disk: diskBasic,
                    network: networkBasic
                }
            };

            // 使用上次的详细数据作为基础
            const detail: Partial<PerformanceDetailData> = lastData?.detail || {};
            
            // 更新活动卡片的详细指标
            if (activeCard) {
                const lastUpdate = this.lastDetailUpdate.get(sessionId) || {};
                const detailData = await this.collectCardDetailMetrics(sessionId, activeCard, activeDetailTab);
                if (detailData) {
                    detail[activeCard] = detailData;
                }

                // 更新最后更新时间
                lastUpdate[activeCard] = Date.now();
                this.lastDetailUpdate.set(sessionId, lastUpdate);
            }

            // 检查并更新非活动卡片
            await this.updateInactiveCardsIfNeeded(sessionId, activeCard, detail);

            performanceData.detail = detail;

            // 保存完整数据
            this.lastPerformanceData.set(sessionId, {
                data: performanceData,
                timestamp: Date.now()
            });

            const endTime = Date.now();
            console.log(`[Performance] 采集性能指标数据完成，用时: ${endTime - startTime}ms`);

            return performanceData;
        } catch (error) {
            console.error('采集性能指标数据失败:', {
                sessionId,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * 检查并更新非活动卡片的数据
     */
    private async updateInactiveCardsIfNeeded(
        sessionId: string,
        activeCard: 'cpu' | 'memory' | 'disk' | 'network' | undefined,
        detail: Partial<PerformanceDetailData>
    ): Promise<void> {
        const lastUpdate = this.lastDetailUpdate.get(sessionId) || {};
        const now = Date.now();

        // 检查每个非活动卡片是否需要更新
        const cards = ['cpu', 'memory', 'disk', 'network'] as const;
        for (const card of cards) {
            if (card === activeCard) continue;
            
            const lastUpdateTime = lastUpdate[card] || 0;
            if (now - lastUpdateTime > this.INACTIVE_UPDATE_INTERVAL) {
                // 异步更新非活动卡片
                this.updateCardDetailAsync(sessionId, card, detail);
            }
        }
    }

    /**
     * 异步更新卡片详细数据
     */
    private async updateCardDetailAsync(
        sessionId: string,
        card: 'cpu' | 'memory' | 'disk' | 'network',
        detail: Partial<PerformanceDetailData>
    ): Promise<void> {
        try {
            const lastUpdate = this.lastDetailUpdate.get(sessionId) || {};
            
            const detailData = await this.collectCardDetailMetrics(sessionId, card);
            if (detailData) {
                detail[card] = detailData;
            }

            // 更新最后更新时间
            lastUpdate[card] = Date.now();
            this.lastDetailUpdate.set(sessionId, lastUpdate);
        } catch (error) {
            console.error(`异步更新${card}详细数据失败:`, error);
        }
    }

    /**
     * 销毁管理器
     */
    destroy(): void {
        this.cpuMetricsService.destroy();
        this.memoryMetricsService.destroy();
        this.diskMetricsService.destroy();
        this.diskHealthService.destroy();
        this.diskSpaceService.destroy();
        this.diskIoService.destroy();
        PerformanceManager.instance = null as any;
    }
} 