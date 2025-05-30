  await this.prisma.anomalyLogRecord.create({
    data: {
      type,
      severity,
      user_id: userId,
      summary: `[${type}] user=${userId ?? 'unknown'}`,
      detected_at: new Date(),
      is_resolved: false
    }
  }); 