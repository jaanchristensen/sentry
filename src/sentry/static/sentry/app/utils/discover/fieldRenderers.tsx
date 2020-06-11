import React from 'react';
import {Location} from 'history';
import partial from 'lodash/partial';
import styled from '@emotion/styled';

import {Organization} from 'app/types';
import {t, tct} from 'app/locale';
import Count from 'app/components/count';
import Duration from 'app/components/duration';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import ScoreBar from 'app/components/scoreBar';
import Tooltip from 'app/components/tooltip';
import UserBadge from 'app/components/idBadge/userBadge';
import Version from 'app/components/version';
import getDynamicText from 'app/utils/getDynamicText';
import {formatFloat, formatPercentage} from 'app/utils/formatters';
import {getAggregateAlias, AGGREGATIONS} from 'app/utils/discover/fields';
import Projects from 'app/utils/projects';
import theme from 'app/utils/theme';

import {
  Container,
  EventId,
  BarContainer,
  NumberContainer,
  OverflowLink,
  StyledDateTime,
  StyledShortId,
  VersionContainer,
} from './styles';
import {MetaType, EventData} from './eventView';

/**
 * Types, functions and definitions for rendering fields in discover results.
 */
type RenderFunctionBaggage = {
  organization: Organization;
  location: Location;
};

type FieldFormatterRenderFunction = (
  field: string,
  data: EventData,
  baggage: RenderFunctionBaggage
) => React.ReactNode;

export type FieldFormatterRenderFunctionPartial = (
  data: EventData,
  baggage: RenderFunctionBaggage
) => React.ReactNode;

type FieldFormatter = {
  isSortable: boolean;
  renderFunc: FieldFormatterRenderFunction;
};

type FieldFormatters = {
  boolean: FieldFormatter;
  date: FieldFormatter;
  duration: FieldFormatter;
  integer: FieldFormatter;
  number: FieldFormatter;
  percentage: FieldFormatter;
  string: FieldFormatter;
};

export type FieldTypes = keyof FieldFormatters;

const emptyValue = <span>{t('n/a')}</span>;
const EmptyValueContainer = styled(Container)`
  color: ${p => p.theme.gray500};
`;

/**
 * A mapping of field types to their rendering function.
 * This mapping is used when a field is not defined in SPECIAL_FIELDS
 * and the field is not being coerced to a link.
 *
 * This mapping should match the output sentry.utils.snuba:get_json_type
 */
const FIELD_FORMATTERS: FieldFormatters = {
  boolean: {
    isSortable: true,
    renderFunc: (field, data) => {
      const value = data[field] ? t('yes') : t('no');
      return <Container>{value}</Container>;
    },
  },
  date: {
    isSortable: true,
    renderFunc: (field, data) => (
      <Container>
        {data[field]
          ? getDynamicText({
              value: <StyledDateTime date={data[field]} />,
              fixed: 'timestamp',
            })
          : emptyValue}
      </Container>
    ),
  },
  duration: {
    isSortable: true,
    renderFunc: (field, data) => (
      <NumberContainer>
        {typeof data[field] === 'number' ? (
          <Duration seconds={data[field] / 1000} fixedDigits={2} abbreviation />
        ) : (
          emptyValue
        )}
      </NumberContainer>
    ),
  },
  integer: {
    isSortable: true,
    renderFunc: (field, data) => (
      <NumberContainer>
        {typeof data[field] === 'number' ? <Count value={data[field]} /> : emptyValue}
      </NumberContainer>
    ),
  },
  number: {
    isSortable: true,
    renderFunc: (field, data) => (
      <NumberContainer>
        {typeof data[field] === 'number' ? formatFloat(data[field], 4) : emptyValue}
      </NumberContainer>
    ),
  },
  percentage: {
    isSortable: true,
    renderFunc: (field, data) => (
      <NumberContainer>
        {typeof data[field] === 'number' ? formatPercentage(data[field]) : emptyValue}
      </NumberContainer>
    ),
  },
  string: {
    isSortable: true,
    renderFunc: (field, data) => {
      // Some fields have long arrays in them, only show the tail of the data.
      const value = Array.isArray(data[field]) ? data[field].slice(-1) : data[field];
      return <Container>{value}</Container>;
    },
  },
};

type SpecialFieldRenderFunc = (
  data: EventData,
  baggage: RenderFunctionBaggage
) => React.ReactNode;

type SpecialField = {
  sortField: string | null;
  renderFunc: SpecialFieldRenderFunc;
};

type SpecialFields = {
  id: SpecialField;
  project: SpecialField;
  user: SpecialField;
  'issue.id': SpecialField;
  issue: SpecialField;
  release: SpecialField;
};

/**
 * "Special fields" either do not map 1:1 to an single column in the event database,
 * or they require custom UI formatting that can't be handled by the datatype formatters.
 */
const SPECIAL_FIELDS: SpecialFields = {
  id: {
    sortField: 'id',
    renderFunc: data => {
      const id: string | unknown = data?.id;
      if (typeof id !== 'string') {
        return null;
      }
      return (
        <Container>
          <EventId value={id} />
        </Container>
      );
    },
  },
  'issue.id': {
    sortField: 'issue.id',
    renderFunc: (data, {organization}) => {
      const target = `/organizations/${organization.slug}/issues/${data['issue.id']}/`;
      return (
        <Container>
          <OverflowLink to={target} aria-label={data['issue.id']}>
            {data['issue.id']}
          </OverflowLink>
        </Container>
      );
    },
  },
  issue: {
    sortField: null,
    renderFunc: (data, {organization}) => {
      const issueID = data['issue.id'];

      if (!issueID) {
        return (
          <Container>
            <StyledShortId shortId={`${data.issue}`} />
          </Container>
        );
      }

      const target = `/organizations/${organization.slug}/issues/${issueID}/`;
      return (
        <Container>
          <OverflowLink to={target} aria-label={issueID}>
            <StyledShortId shortId={`${data.issue}`} />
          </OverflowLink>
        </Container>
      );
    },
  },
  project: {
    sortField: 'project',
    renderFunc: (data, {organization}) => {
      return (
        <Container>
          <Projects orgId={organization.slug} slugs={[data.project]}>
            {({projects}) => {
              const project = projects.find(p => p.slug === data.project);
              return (
                <ProjectBadge
                  project={project ? project : {slug: data.project}}
                  avatarSize={16}
                />
              );
            }}
          </Projects>
        </Container>
      );
    },
  },
  user: {
    sortField: 'user.id',
    renderFunc: data => {
      const userObj = {
        id: data.user,
        name: data.user,
        email: data.user,
        username: data.user,
        ip_address: '',
      };

      if (data.user) {
        const badge = <UserBadge user={userObj} hideEmail avatarSize={16} />;
        return <Container>{badge}</Container>;
      }

      return <EmptyValueContainer>{emptyValue}</EmptyValueContainer>;
    },
  },
  release: {
    sortField: 'release',
    renderFunc: data =>
      data.release && (
        <VersionContainer>
          <Version version={data.release} anchor={false} tooltipRawVersion truncate />
        </VersionContainer>
      ),
  },
};

type SpecialFunctions = {
  user_misery: SpecialFieldRenderFunc;
};

/**
 * "Special functions" are functions whose values either do not map 1:1 to a single column,
 * or they require custom UI formatting that can't be handled by the datatype formatters.
 */
const SPECIAL_FUNCTIONS: SpecialFunctions = {
  user_misery: data => {
    const uniqueUsers = data.count_unique_user;
    let userMiseryField: string = '';
    for (const field in data) {
      if (field.startsWith('user_misery')) {
        userMiseryField = field;
      }
    }
    if (!userMiseryField) {
      return <NumberContainer>{emptyValue}</NumberContainer>;
    }

    const userMisery = data[userMiseryField];
    if (!uniqueUsers && uniqueUsers !== 0) {
      return (
        <NumberContainer>
          {typeof userMisery === 'number' ? formatFloat(userMisery, 4) : emptyValue}
        </NumberContainer>
      );
    }

    const palette = new Array(10).fill(theme.purpleDarkest);
    const score = Math.floor((userMisery / Math.max(uniqueUsers, 1)) * palette.length);
    const miseryLimit = parseInt(userMiseryField.split('_').pop() || '', 10);
    const miseryPercentage = ((100 * userMisery) / Math.max(uniqueUsers, 1)).toFixed(2);

    const title = tct(
      '[affectedUsers] out of [totalUsers] ([miseryPercentage]%) unique users waited more than [duration]ms',
      {
        affectedUsers: userMisery,
        totalUsers: uniqueUsers,
        miseryPercentage,
        duration: 4 * miseryLimit,
      }
    );
    return (
      <BarContainer>
        <Tooltip title={title} disabled={false} containerDisplayMode="block">
          <ScoreBar size={20} score={score} palette={palette} radius={0} />
        </Tooltip>
      </BarContainer>
    );
  },
};

/**
 * Get the sort field name for a given field if it is special or fallback
 * to the generic type formatter.
 */
export function getSortField(
  field: string,
  tableMeta: MetaType | undefined
): string | null {
  if (SPECIAL_FIELDS.hasOwnProperty(field)) {
    return SPECIAL_FIELDS[field as keyof typeof SPECIAL_FIELDS].sortField;
  }

  if (!tableMeta) {
    return field;
  }

  for (const alias in AGGREGATIONS) {
    if (field.startsWith(alias)) {
      return AGGREGATIONS[alias].isSortable ? field : null;
    }
  }

  const fieldType = tableMeta[field];
  if (FIELD_FORMATTERS.hasOwnProperty(fieldType)) {
    return FIELD_FORMATTERS[fieldType as keyof typeof FIELD_FORMATTERS].isSortable
      ? field
      : null;
  }

  return null;
}

/**
 * Get the field renderer for the named field and metadata
 *
 * @param {String} field name
 * @param {object} metadata mapping.
 * @returns {Function}
 */
export function getFieldRenderer(
  field: string,
  meta: MetaType
): FieldFormatterRenderFunctionPartial {
  if (SPECIAL_FIELDS.hasOwnProperty(field)) {
    return SPECIAL_FIELDS[field].renderFunc;
  }
  const fieldName = getAggregateAlias(field);
  const fieldType = meta[fieldName];

  for (const alias in SPECIAL_FUNCTIONS) {
    if (fieldName.startsWith(alias)) {
      return SPECIAL_FUNCTIONS[alias];
    }
  }

  if (FIELD_FORMATTERS.hasOwnProperty(fieldType)) {
    return partial(FIELD_FORMATTERS[fieldType].renderFunc, fieldName);
  }
  return partial(FIELD_FORMATTERS.string.renderFunc, fieldName);
}
