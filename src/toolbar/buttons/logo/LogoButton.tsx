// SPDX-License-Identifier: MIT
// Copyright (c) 2020-2023 The Pybricks Authors

import React from 'react';
import ActionButton, { ActionButtonProps } from '../../ActionButton';
import { useI18n } from './i18n';
import logoIcon from './logo.png';

type LogoButtonProps = Pick<ActionButtonProps, 'id'>;

const LogoButton: React.FunctionComponent<LogoButtonProps> = ({ id }) => {
    const i18n = useI18n();

    const handleClick = () => {
        window.open(
            'https://github.com/FLL-Team-44966/pybricks-code',
            '_blank',
            'noopener,noreferrer',
        );
    };

    return (
        <ActionButton
            id={id}
            label={i18n.translate('label')}
            tooltip={i18n.translate('tooltip')}
            icon={logoIcon}
            enabled={true}
            onAction={handleClick}
        />
    );
};

export default LogoButton;
