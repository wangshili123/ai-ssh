import { SSHService } from '../../types';
import { MonitorData, PerformanceData, PerformanceDetailData } from '../../types/monitor';
import { CpuMetricsService } from './metrics/cpuService';
import { MemoryMetricsService } from './metrics/memoryService';
import { DiskMetricsService } from './metrics/diskService';
import { DiskHealthService } from './metrics/diskHealthService';
import { DiskSpaceService } from './metrics/diskSpaceService';
import { DiskIoService } from './metrics/diskIoService';

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

    // 数据缓存
    private metricsCache: Map<string, {
        data: Partial<MonitorData>;
        timestamp: number;
    }> = new Map();
    
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
     * 采集性能指标数据
     * @param sessionId 会话ID
     * @param activeCard 当前激活的卡片类型
     * @param activeDetailTab 当前激活的详情标签页
     */
    async collectMetrics(
        sessionId: string,
        activeCard?: string,
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

            // 根据激活的卡片类型获取详细指标
            if (activeCard) {
                const detail: Partial<PerformanceDetailData> = {};

                switch (activeCard) {
                    case 'cpu':
                        detail.cpu = await this.cpuMetricsService.collectDetailMetrics(sessionId, activeDetailTab);
                        break;
                    case 'memory':
                        detail.memory = await this.memoryMetricsService.collectDetailMetrics(sessionId);
                        break;
                    case 'disk':
                        const [diskDetail, diskHealth, diskSpace, diskIo] = await Promise.all([
                            this.diskMetricsService.collectDetailMetrics(sessionId),
                            this.diskHealthService.getDiskHealth(sessionId),
                            this.diskSpaceService.getSpaceAnalysis(sessionId),
                            this.diskIoService.getIoAnalysis(sessionId)
                        ]);
                        detail.disk = {
                            ...diskDetail,
                            health: diskHealth,
                            spaceAnalysis: diskSpace,
                            ioAnalysis: diskIo
                        };
                        break;
                    case 'network':
                        // TODO: 实现网络详细指标采集
                        break;
                }

                performanceData.detail = detail;
            }

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