export function createDailyInputs({
  companies,
  regimes,
  events,
  random = Math.random,
}) {
  const regime =
    regimes[Math.floor(random() * regimes.length)];

  const sectors = [
    'STABLE',
    'GROWTH',
    'SPECULATIVE',
  ];

  const lead =
    sectors[Math.floor(random() * sectors.length)];

  const remainingSectors =
    sectors.filter(id => id !== lead);

  const lag =
    remainingSectors[
      Math.floor(random() * remainingSectors.length)
    ];

  const sectorNames = {
    STABLE: '稳健板块走强',
    GROWTH: '成长板块走强',
    SPECULATIVE: '投机板块走强',
  };

  const inputs = Object.fromEntries(
    companies.map(company => [
      company.id,
      {
        businessChange:
          regime.business
          + (random() - 0.5)
          * company.volatility
          * 0.55,

        sentiment:
          regime.sentiment
          + (random() - 0.5)
          * company.volatility
          * 0.8,

        marketChange: regime.market,

        sectorChange:
          company.category === lead
            ? 0.008
            : company.category === lag
              ? -0.005
              : 0,

        liquidityShock:
          (random() - 0.5)
          * company.volatility
          * 0.28,

        eventChange: 0,
        eventPriceChange: 0,
      },
    ]),
  );

  inputs.__regime = regime.name;
  inputs.__sectorLead = sectorNames[lead];

  if (random() < 0.72) {
    const target =
      companies[Math.floor(random() * companies.length)];

    const companyEvents = events[target.id];

    const event =
      companyEvents[
        Math.floor(random() * companyEvents.length)
      ];

    Object.assign(inputs[target.id], {
      eventLabel: event[0],
      eventChange: event[1],
      eventPriceChange: event[2],
    });
  }

  return inputs;
}